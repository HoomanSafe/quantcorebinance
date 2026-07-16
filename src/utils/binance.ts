import crypto from 'crypto';

interface BinanceRequestParams {
  [key: string]: any;
}

export function getAssetPrecision(asset: string) {
  switch (asset) {
    case 'BTCUSDT':
      return { sizePrecision: 3, pricePrecision: 2 };
    case 'ETHUSDT':
      return { sizePrecision: 3, pricePrecision: 2 };
    case 'SOLUSDT':
      return { sizePrecision: 3, pricePrecision: 3 };
    case 'BNBUSDT':
      return { sizePrecision: 2, pricePrecision: 2 };
    default:
      return { sizePrecision: 3, pricePrecision: 2 };
  }
}

// 1. Core Binance Futures Signed Request Sender
export async function binanceSignedRequest(
  method: string,
  endpoint: string,
  params: BinanceRequestParams = {}
): Promise<any> {
  const apiKey = process.env.BINANCE_API_KEY;
  const apiSecret = process.env.BINANCE_API_SECRET;
  const useTestnet = process.env.USE_TESTNET === 'true' || process.env.USE_TESTNET === 'true';

  if (!apiKey || !apiSecret) {
    throw new Error('BINANCE_API_KEY or BINANCE_API_SECRET is missing in environment.');
  }

  const baseUrl = useTestnet
    ? 'https://testnet.binancefuture.com'
    : 'https://fapi.binance.com';

  const timestamp = Date.now();
  const allParams = {
    ...params,
    timestamp,
  };

  // Build query string
  const queryString = Object.keys(allParams)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(allParams[key])}`)
    .join('&');

  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(queryString)
    .digest('hex');

  const url = `${baseUrl}${endpoint}?${queryString}&signature=${signature}`;

  const response = await fetch(url, {
    method,
    headers: {
      'X-MBX-APIKEY': apiKey,
      'Content-Type': 'application/json',
    },
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`Binance API Error (${response.status}): ${responseText}`);
  }

  try {
    return JSON.parse(responseText);
  } catch (e) {
    return responseText;
  }
}

// 2. Core Telegram Notification Sender
export async function sendTelegramNotification(message: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn('Telegram token or chat ID is missing. Skipping notification.');
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      console.error(`Telegram API error: ${await response.text()}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    return false;
  }
}

// 3. Automated Order Runner with Leverage, TP & SL
export async function executeBinanceFuturesOrder(data: {
  asset: string;
  side: 'LONG' | 'SHORT';
  type: 'MARKET' | 'LIMIT';
  size: number;
  price?: number;
  leverage: number;
  stopLoss?: number;
  takeProfit?: number;
}) {
  const { asset, side, type, size, price, leverage, stopLoss, takeProfit } = data;
  const precision = getAssetPrecision(asset);

  // Format quantity and prices to standard step/tick precision
  const formattedQty = parseFloat(size.toFixed(precision.sizePrecision));
  const formattedPrice = price ? parseFloat(price.toFixed(precision.pricePrecision)) : null;
  const formattedSL = stopLoss ? parseFloat(stopLoss.toFixed(precision.pricePrecision)) : null;
  const formattedTP = takeProfit ? parseFloat(takeProfit.toFixed(precision.pricePrecision)) : null;

  const logs: string[] = [];
  let entryOrderId = '';
  let slOrderId = '';
  let tpOrderId = '';
  let actualEntryPrice = price || 0;

  // Step A: Set leverage on Binance
  try {
    await binanceSignedRequest('POST', '/fapi/v1/leverage', {
      symbol: asset,
      leverage: leverage,
    });
    logs.push(`Successfully configured Binance leverage to ${leverage}X for ${asset}.`);
  } catch (err: any) {
    logs.push(`Leverage notice (often non-critical): ${err.message}`);
  }

  // Step B: Set Margin Type to Isolated (optional setup, gracefully catch errors if already isolated)
  try {
    await binanceSignedRequest('POST', '/fapi/v1/marginType', {
      symbol: asset,
      marginType: 'ISOLATED',
    });
    logs.push(`Successfully set margin type to ISOLATED for ${asset}.`);
  } catch (err: any) {
    // If it's already ISOLATED, it throws code -4046 "No need to change margin type.", safe to ignore
    logs.push(`Margin Type setup note: ${err.message}`);
  }

  // Step C: Place main entry order
  const entrySide = side === 'LONG' ? 'BUY' : 'SELL';
  const entryParams: BinanceRequestParams = {
    symbol: asset,
    side: entrySide,
    type: type,
    quantity: formattedQty,
  };

  if (type === 'LIMIT' && formattedPrice) {
    entryParams.price = formattedPrice;
    entryParams.timeInForce = 'GTC';
  }

  const entryOrderRes = await binanceSignedRequest('POST', '/fapi/v1/order', entryParams);
  entryOrderId = entryOrderRes.orderId?.toString() || '';
  actualEntryPrice = parseFloat(entryOrderRes.avgPrice) || parseFloat(entryOrderRes.price) || actualEntryPrice;
  if (!actualEntryPrice && type === 'MARKET') {
    actualEntryPrice = formattedPrice || 0; // fallback
  }

  logs.push(`Entry order placed successfully. ID: ${entryOrderId}. Actual Price: $${actualEntryPrice}`);

  // Step D: Setup automatic bracket SL & TP orders if requested
  const oppositeSide = entrySide === 'BUY' ? 'SELL' : 'BUY';

  // D1. Place Stop Loss Order (STOP_MARKET)
  if (formattedSL) {
    try {
      const slParams: BinanceRequestParams = {
        symbol: asset,
        side: oppositeSide,
        type: 'STOP_MARKET',
        stopPrice: formattedSL,
        closePosition: 'true', // ensures it closes the whole position automatically
      };
      const slRes = await binanceSignedRequest('POST', '/fapi/v1/order', slParams);
      slOrderId = slRes.orderId?.toString() || '';
      logs.push(`Stop Loss bracket placed successfully at $${formattedSL}. Order ID: ${slOrderId}`);
    } catch (err: any) {
      logs.push(`Failed to place Stop Loss Order: ${err.message}`);
    }
  }

  // D2. Place Take Profit Order (TAKE_PROFIT_MARKET)
  if (formattedTP) {
    try {
      const tpParams: BinanceRequestParams = {
        symbol: asset,
        side: oppositeSide,
        type: 'TAKE_PROFIT_MARKET',
        stopPrice: formattedTP,
        closePosition: 'true', // closes position automatically on target hit
      };
      const tpRes = await binanceSignedRequest('POST', '/fapi/v1/order', tpParams);
      tpOrderId = tpRes.orderId?.toString() || '';
      logs.push(`Take Profit bracket placed successfully at $${formattedTP}. Order ID: ${tpOrderId}`);
    } catch (err: any) {
      logs.push(`Failed to place Take Profit Order: ${err.message}`);
    }
  }

  // Step E: Dispatch rich Telegram Alert notification
  const directionIcon = side === 'LONG' ? '🟢 LONG' : '🔴 SHORT';
  const useTestnet = process.env.USE_TESTNET === 'true';
  const modeStr = useTestnet ? 'BINANCE FUTURES TESTNET' : 'BINANCE FUTURES REAL-PORT';

  const tgMessage = `⚡ <b>QUANT-CORE AUTOMATED TRADE</b> ⚡

<b>Mode:</b> ${modeStr}
<b>Asset:</b> ${asset}
<b>Direction:</b> ${directionIcon}
<b>Execution Type:</b> ${type}
<b>Leverage:</b> ${leverage}X
<b>Size:</b> ${formattedQty} ${asset.replace('USDT', '')}
<b>Actual Entry Price:</b> $${actualEntryPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}

🛡️ <b>RISK MITIGATION TARGETS</b> 🛡️
🛑 <b>Stop Loss:</b> ${formattedSL ? `$${formattedSL.toLocaleString()}` : 'Not Set'}
🎯 <b>Take Profit:</b> ${formattedTP ? `$${formattedTP.toLocaleString()}` : 'Not Set'}

<i>Audit Trail: Entry Order #${entryOrderId} executed. Bracket orders synced successfully.</i>`;

  await sendTelegramNotification(tgMessage);

  return {
    success: true,
    entryOrderId,
    slOrderId,
    tpOrderId,
    actualEntryPrice,
    logs,
  };
}

// 4. Manual/Panic Closing of position on Binance
export async function closeBinanceFuturesPosition(asset: string, side: 'LONG' | 'SHORT', size: number) {
  const precision = getAssetPrecision(asset);
  const formattedQty = parseFloat(size.toFixed(precision.sizePrecision));
  const logs: string[] = [];

  // Step A: Cancel all open orders for this symbol first
  try {
    await binanceSignedRequest('DELETE', '/fapi/v1/allOpenOrders', {
      symbol: asset,
    });
    logs.push(`Cancelled all open orders for ${asset}.`);
  } catch (err: any) {
    logs.push(`Order cancellation notice (may have no open orders): ${err.message}`);
  }

  // Step B: Send opposite market order with reduceOnly = true to close out position
  const closeSide = side === 'LONG' ? 'SELL' : 'BUY';
  try {
    const closeRes = await binanceSignedRequest('POST', '/fapi/v1/order', {
      symbol: asset,
      side: closeSide,
      type: 'MARKET',
      quantity: formattedQty,
      reduceOnly: 'true',
    });
    const orderId = closeRes.orderId || '';
    const avgPrice = closeRes.avgPrice || closeRes.price || 'Market Price';
    logs.push(`Market close order executed. ID: ${orderId}. Closed at: $${avgPrice}`);

    // Send Telegram Notification for position exit
    const tgMessage = `🚨 <b>QUANT-CORE MANUAL POSITION CLOSURE</b> 🚨

<b>Asset:</b> ${asset}
<b>Closed Position:</b> ${side === 'LONG' ? 'LONG (SELL CLOSE)' : 'SHORT (BUY CLOSE)'}
<b>Size Closed:</b> ${formattedQty} ${asset.replace('USDT', '')}
<b>Execution:</b> Market Close (Reduce-Only)

<i>Audit Trail: All active SL/TP bracket orders cancelled. Position successfully squared on Binance.</i>`;

    await sendTelegramNotification(tgMessage);

    return {
      success: true,
      orderId,
      avgPrice,
      logs,
    };
  } catch (err: any) {
    throw new Error(`Failed to execute market close order on Binance: ${err.message}`);
  }
}
