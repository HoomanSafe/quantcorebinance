import { Asset, Candle, OrderBlock, FairValueGap, MarketState, ScoringDetails } from '../types';

class MarketSimulator {
  private states: Record<Asset, MarketState>;
  private basePrices: Record<Asset, number> = {
    BTCUSDT: 95420,
    ETHUSDT: 2840,
    SOLUSDT: 184.5,
    BNBUSDT: 618.2,
  };
  private intervals: Record<Asset, NodeJS.Timeout | null> = {
    BTCUSDT: null,
    ETHUSDT: null,
    SOLUSDT: null,
    BNBUSDT: null,
  };

  constructor() {
    this.states = {} as Record<Asset, MarketState>;
    this.initializeAll();
    this.startTicking();
  }

  private initializeAll() {
    (Object.keys(this.basePrices) as Asset[]).forEach((asset) => {
      this.states[asset] = this.generateInitialState(asset);
    });
  }

  private generateInitialState(asset: Asset): MarketState {
    const basePrice = this.basePrices[asset];
    const candles: Candle[] = [];
    const now = Date.now();

    // Generate 50 historical candles (1-minute intervals)
    let currentPrice = basePrice;
    for (let i = 49; i >= 0; i--) {
      const timeStr = new Date(now - i * 60000).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const change = (Math.random() - 0.49) * (basePrice * 0.001); // slight upward bias
      const open = currentPrice;
      const close = currentPrice + change;
      const high = Math.max(open, close) + Math.random() * (basePrice * 0.0005);
      const low = Math.min(open, close) - Math.random() * (basePrice * 0.0005);
      const volume = Math.floor(Math.random() * 500) + 100;

      candles.push({
        time: timeStr,
        open: parseFloat(open.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        close: parseFloat(close.toFixed(2)),
        volume,
      });
      currentPrice = close;
    }

    // Set up Order Blocks based on swing highs/lows
    const orderBlocks: OrderBlock[] = [
      {
        id: `${asset}-ob-bullish-1`,
        type: 'bullish',
        priceStart: parseFloat((currentPrice * 0.995).toFixed(2)),
        priceEnd: parseFloat((currentPrice * 0.991).toFixed(2)),
        label: 'H1 Bullish Rejection OB (Demand)',
        isMitigated: false,
      },
      {
        id: `${asset}-ob-bearish-1`,
        type: 'bearish',
        priceStart: parseFloat((currentPrice * 1.008).toFixed(2)),
        priceEnd: parseFloat((currentPrice * 1.004).toFixed(2)),
        label: 'H1 Bearish Mitigation OB (Supply)',
        isMitigated: false,
      },
    ];

    // Set up Fair Value Gaps
    const fairValueGaps: FairValueGap[] = [
      {
        id: `${asset}-fvg-bullish-1`,
        type: 'bullish',
        high: parseFloat((currentPrice * 0.998).toFixed(2)),
        low: parseFloat((currentPrice * 0.996).toFixed(2)),
        label: 'M15 Bullish FVG (Imbalance)',
        isMitigated: false,
      },
      {
        id: `${asset}-fvg-bearish-1`,
        type: 'bearish',
        high: parseFloat((currentPrice * 1.003).toFixed(2)),
        low: parseFloat((currentPrice * 1.001).toFixed(2)),
        label: 'M15 Bearish FVG (Imbalance)',
        isMitigated: false,
      },
    ];

    // Taker ratio fluctuates. Let's start with a high ratio matching the user prompt
    const takerRatio = 0.63;
    const cvd = Math.floor((Math.random() - 0.4) * 1500000);

    const bids = this.generateOrderBook(currentPrice, 'bids');
    const asks = this.generateOrderBook(currentPrice, 'asks');

    const scoring = this.calculateScoring(asset, currentPrice, takerRatio, orderBlocks, fairValueGaps, 10, 1.5);

    return {
      asset,
      price: parseFloat(currentPrice.toFixed(2)),
      change24h: parseFloat(((currentPrice - basePrice) / basePrice * 100).toFixed(2)),
      high24h: parseFloat((basePrice * 1.02).toFixed(2)),
      low24h: parseFloat((basePrice * 0.98).toFixed(2)),
      volume24h: Math.floor(Math.random() * 5000000) + 1000000,
      takerRatio,
      cvd,
      bids,
      asks,
      candles,
      orderBlocks,
      fairValueGaps,
      scoring,
    };
  }

  private generateOrderBook(price: number, side: 'bids' | 'asks') {
    const book = [];
    const isBids = side === 'bids';
    const step = price * 0.0002;

    for (let i = 1; i <= 10; i++) {
      const offset = i * step;
      const orderPrice = isBids ? price - offset : price + offset;
      const size = Math.random() * (isBids ? 5 : 4) + 0.1;
      book.push({
        price: parseFloat(orderPrice.toFixed(2)),
        size: parseFloat(size.toFixed(3)),
      });
    }

    if (isBids) {
      book.sort((a, b) => b.price - a.price);
    } else {
      book.sort((a, b) => a.price - b.price);
    }
    return book;
  }

  private calculateScoring(
    asset: Asset,
    price: number,
    takerRatio: number,
    obs: OrderBlock[],
    fvgs: FairValueGap[],
    leverage: number,
    riskPercent: number
  ): ScoringDetails {
    // Layer 1: Structure & Direction
    // Let's assume market trend is Bullish with high scoring
    const l1Trend = 'BULLISH';
    const l1Structure = 'H1 Bullish BOS detected + Swing High Swept';
    const l1Score = 88;
    const l1Reasoning = 'SMC structure aligns perfectly with bullish bias. Trend is solid above 50/200 EMA regimes, showing clear bullish break of structure (BOS) and higher-high progression.';

    // Layer 2: Location
    // Proximity to Bullish OB or FVG
    let activeBullishOB = obs.find((o) => o.type === 'bullish');
    let l2ObProx = 'Neutral proximity';
    let l2FvgProx = 'Neutral proximity';
    let l2Score = 65;
    let l2Reasoning = 'Price is in the equilibrium zone, pending retracement to institutional support levels.';

    if (activeBullishOB) {
      const distPercent = Math.abs(price - activeBullishOB.priceStart) / price;
      if (distPercent < 0.004) {
        l2ObProx = 'Retesting Bullish Demand OB';
        l2FvgProx = 'Mitigating Bullish FVG';
        l2Score = 92;
        l2Reasoning = 'Price is deeply inside the Discount Zone, tapping directly into the H1 Bullish Demand Order Block & mitigating the M15 FVG. High-probability institutional loading zone.';
      } else if (distPercent < 0.01) {
        l2ObProx = 'Approaching Bullish OB';
        l2FvgProx = 'Partially retesting FVG';
        l2Score = 80;
        l2Reasoning = 'Price is entering the discount area and approaching the key H1 Bullish OB support. Location scoring is favorable.';
      }
    }

    // Layer 3: Volume & Aggression
    // Taker Buy/Sell ratio delta balance
    let l3Score = 50;
    let l3Delta = 'Neutral order flow';
    if (takerRatio >= 0.60) {
      l3Score = Math.min(98, 50 + (takerRatio - 0.5) * 300);
      l3Delta = `+$${Math.floor((takerRatio - 0.5) * 8500000)} Taker Buy Delta`;
    } else if (takerRatio <= 0.45) {
      l3Score = Math.max(10, 50 - (0.5 - takerRatio) * 300);
      l3Delta = `-$${Math.floor((0.5 - takerRatio) * 8500000)} Taker Sell Delta`;
    }
    const l3Reasoning = `Taker ratio at ${takerRatio}x delta balance shows heavy institutional buying aggression. Limit buying is matching order blocks while aggressive buyers are hitting the asks.`;

    // Layer 4: Risk Optimization
    let l4Score = 100;
    let l4Reasoning = 'All Risk buffers cleared. Leverage is within institutional bounds (10X). Daily loss bounds active.';
    if (leverage > 10) {
      l4Score -= (leverage - 10) * 8;
      l4Reasoning = `Leverage of ${leverage}X exceeds the standard institutional safety threshold (10X). Margin risk elevated.`;
    }
    if (riskPercent > 1.5) {
      l4Score -= (riskPercent - 1.5) * 20;
      l4Reasoning += ` Risk per trade of ${riskPercent}% exceeds standard 1.5% bounds.`;
    }
    l4Score = Math.max(15, l4Score);

    const aggregateScore = Math.round((l1Score * 0.3) + (l2Score * 0.3) + (l3Score * 0.25) + (l4Score * 0.15));

    let signal: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL' = 'NEUTRAL';
    if (aggregateScore >= 85) signal = 'STRONG_BUY';
    else if (aggregateScore >= 70) signal = 'BUY';
    else if (aggregateScore <= 35) signal = 'STRONG_SELL';
    else if (aggregateScore <= 45) signal = 'SELL';

    return {
      layer1: { name: 'Layer 1: Structure & Direction', description: 'SMC Structure & Trend Regime', trend: l1Trend, smcStructure: l1Structure, score: l1Score, reasoning: l1Reasoning },
      layer2: { name: 'Layer 2: Location (OB/FVG)', description: 'Retest zones & Imbalances', obProximity: l2ObProx, fvgProximity: l2FvgProx, score: l2Score, reasoning: l2Reasoning },
      layer3: { name: 'Layer 3: Volume & Aggression', description: 'Taker delta & order aggression', takerRatio, volumeDelta: l3Delta, score: Math.round(l3Score), reasoning: l3Reasoning },
      layer4: { name: 'Layer 4: Risk Optimization', description: 'Leverage caps & daily drawdowns', riskBuffersCleared: true, dailyLossBoundsActive: true, score: l4Score, reasoning: l4Reasoning },
      aggregateScore,
      signal,
    };
  }

  private startTicking() {
    (Object.keys(this.basePrices) as Asset[]).forEach((asset) => {
      this.intervals[asset] = setInterval(() => {
        this.tickAsset(asset);
      }, 3000); // tick every 3 seconds
    });
  }

  private tickAsset(asset: Asset) {
    const state = this.states[asset];
    if (!state) return;

    // Simulate small price changes
    const volatility = asset === 'SOLUSDT' ? 0.0015 : asset === 'BTCUSDT' ? 0.0006 : 0.0009;
    const isUpTick = Math.random() > 0.48; // slight upward bias
    const priceChange = (isUpTick ? 1 : -1) * (state.price * volatility * Math.random());
    const newPrice = Math.max(1, state.price + priceChange);

    // Update bids/asks around new price
    const bids = this.generateOrderBook(newPrice, 'bids');
    const asks = this.generateOrderBook(newPrice, 'asks');

    // Fluctuate taker buy/sell ratio
    // Every few ticks, let's trigger a high-aggression buy wave (taker ratio ~ 0.63x)
    const tickCount = Math.floor(Date.now() / 3000) % 20;
    let takerRatio = 0.51 + (Math.random() - 0.5) * 0.08; // normal distribution around 0.51
    if (tickCount >= 8 && tickCount <= 12) {
      takerRatio = 0.61 + Math.random() * 0.05; // institutional buy wave (around 0.63x!)
    } else if (tickCount >= 18) {
      takerRatio = 0.42 + Math.random() * 0.06; // take profit wave
    }

    // Update CVD
    const cvdChange = Math.floor((takerRatio - 0.5) * state.price * 25);
    const newCvd = state.cvd + cvdChange;

    // Update last candle or push a new one if 1 minute has elapsed
    const candles = [...state.candles];
    const lastCandle = candles[candles.length - 1];
    const nowTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // For simplicity, update the last candle and push a new one if seconds === "00" or simple rotation
    // Let's do a simple rotational update: every 20 ticks (60s), rotate candles
    if (Math.random() < 0.05 && candles.length > 0) {
      candles.shift();
      const newCandle: Candle = {
        time: nowTimeStr,
        open: lastCandle.close,
        high: lastCandle.close,
        low: lastCandle.close,
        close: lastCandle.close,
        volume: Math.floor(Math.random() * 500) + 100,
      };
      candles.push(newCandle);
    } else if (candles.length > 0) {
      const idx = candles.length - 1;
      candles[idx] = {
        ...candles[idx],
        high: parseFloat(Math.max(candles[idx].high, newPrice).toFixed(2)),
        low: parseFloat(Math.min(candles[idx].low, newPrice).toFixed(2)),
        close: parseFloat(newPrice.toFixed(2)),
      };
    }

    // Adapt Order Blocks & FVGs to move with the price sometimes to simulate new structure creation
    let orderBlocks = [...state.orderBlocks];
    let fairValueGaps = [...state.fairValueGaps];

    if (Math.random() < 0.02) {
      // Create a new bullish order block at support
      orderBlocks = [
        {
          id: `${asset}-ob-bullish-${Date.now()}`,
          type: 'bullish',
          priceStart: parseFloat((newPrice * 0.996).toFixed(2)),
          priceEnd: parseFloat((newPrice * 0.992).toFixed(2)),
          label: 'H1 Bullish Rejection OB (Demand)',
          isMitigated: false,
        },
        orderBlocks[1] || orderBlocks[0],
      ];
    }

    if (Math.random() < 0.02) {
      // Create a new bearish order block at resistance
      orderBlocks = [
        orderBlocks[0],
        {
          id: `${asset}-ob-bearish-${Date.now()}`,
          type: 'bearish',
          priceStart: parseFloat((newPrice * 1.006).toFixed(2)),
          priceEnd: parseFloat((newPrice * 1.002).toFixed(2)),
          label: 'H1 Bearish Mitigation OB (Supply)',
          isMitigated: false,
        },
      ];
    }

    // Re-evaluate 4-layer scoring
    const scoring = this.calculateScoring(asset, newPrice, takerRatio, orderBlocks, fairValueGaps, 10, 1.5);

    // Update state
    this.states[asset] = {
      ...state,
      price: parseFloat(newPrice.toFixed(2)),
      change24h: parseFloat(((newPrice - this.basePrices[asset]) / this.basePrices[asset] * 100).toFixed(2)),
      takerRatio: parseFloat(takerRatio.toFixed(2)),
      cvd: newCvd,
      bids,
      asks,
      candles,
      orderBlocks,
      fairValueGaps,
      scoring,
    };
  }

  public getMarketState(asset: Asset, leverage: number, riskPercent: number): MarketState {
    const state = this.states[asset];
    if (!state) {
      return this.generateInitialState(asset);
    }
    // Re-calculate scoring dynamically when custom leverage/risk is passed
    const updatedScoring = this.calculateScoring(
      asset,
      state.price,
      state.takerRatio,
      state.orderBlocks,
      state.fairValueGaps,
      leverage,
      riskPercent
    );

    return {
      ...state,
      scoring: updatedScoring,
    };
  }

  public getBacktest(asset: Asset, leverage: number, riskPercent: number): any {
    // Generate simulated backtest results
    const basePrice = this.basePrices[asset];
    let balance = 10000;
    const trades: any[] = [];
    const now = Date.now();
    let wins = 0;

    // Simulate 30 trades over the last 30 days
    for (let i = 29; i >= 0; i--) {
      const dayOffset = i * 24 * 3600000;
      const tradeTime = new Date(now - dayOffset).toISOString().split('T')[0] + ' ' + '14:30:00';
      const isWin = Math.random() < 0.68; // 68% Win Rate strategy!
      const side = Math.random() > 0.3 ? 'LONG' : 'SHORT';

      // 1.5% Risk Control per trade
      const riskAmount = balance * (riskPercent / 100);
      let pnl = 0;
      let pnlPercent = 0;

      if (isWin) {
        wins++;
        // Profit 10% to 20% on everyday? Wait, profit is limited by risk.
        // With 10X leverage and stop/tp, a winning trade achieves a 1.5x to 2.5x Reward-to-Risk ratio
        const rewardRatio = 1.5 + Math.random() * 1.0; // 1.5R to 2.5R
        pnl = riskAmount * rewardRatio;
        pnlPercent = (pnl / (balance / leverage)) * 100;
      } else {
        pnl = -riskAmount;
        pnlPercent = -riskPercent * leverage;
      }

      balance += pnl;

      trades.push({
        id: `trade-${asset}-${i}`,
        asset,
        side,
        entryPrice: parseFloat((basePrice * (0.95 + Math.random() * 0.1)).toFixed(2)),
        exitPrice: parseFloat((basePrice * (0.95 + Math.random() * 0.1)).toFixed(2)),
        size: parseFloat((riskAmount / (basePrice * 0.015)).toFixed(3)),
        leverage,
        pnl: parseFloat(pnl.toFixed(2)),
        pnlPercent: parseFloat(pnlPercent.toFixed(2)),
        timestamp: tradeTime,
        reason: isWin
          ? 'Layer 1-3 scores aligned (Score: 88). OB tapped + Taker Ratio 0.63x. Exit at 2.0R take-profit bounds.'
          : 'Price penetrated Bullish OB. Stop-loss buffer triggered at 1.5% limit.',
      });
    }

    const totalReturn = parseFloat((((balance - 10000) / 10000) * 100).toFixed(2));
    const profitFactor = parseFloat((wins * 1.8 / (30 - wins)).toFixed(2));

    return {
      asset,
      startDate: new Date(now - 30 * 24 * 3600000).toLocaleDateString(),
      endDate: new Date(now).toLocaleDateString(),
      initialBalance: 10000,
      finalBalance: parseFloat(balance.toFixed(2)),
      totalReturn,
      winRate: parseFloat(((wins / 30) * 100).toFixed(1)),
      totalTrades: 30,
      profitFactor: isNaN(profitFactor) ? 2.3 : profitFactor,
      maxDrawdown: parseFloat((3.5 + Math.random() * 2).toFixed(2)), // Very managed drawdown!
      trades: trades.reverse(),
    };
  }
}

export const marketSim = new MarketSimulator();
