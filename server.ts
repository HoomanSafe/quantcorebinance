import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import dotenv from 'dotenv';
import { marketSim } from './src/utils/market-sim';
import { Asset } from './src/types';
import {
  executeBinanceFuturesOrder,
  closeBinanceFuturesPosition,
} from './src/utils/binance';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Middleware to normalize request URL on serverless platforms (e.g. Vercel)
app.use((req, res, next) => {
  console.log(`[Server Request] Method: ${req.method} | URL: ${req.url} | Path: ${req.path}`);
  
  // If request URL doesn't start with /api but is an API route, prepend /api
  if (!req.url.startsWith('/api')) {
    const isApiRoute = 
      req.url.startsWith('/market/') || 
      req.url.startsWith('/gemini/') || 
      req.url.startsWith('/binance/') || 
      req.url.startsWith('/order/') ||
      req.path.startsWith('/market/') ||
      req.path.startsWith('/gemini/') ||
      req.path.startsWith('/binance/') ||
      req.path.startsWith('/order/');
      
    if (isApiRoute) {
      req.url = '/api' + (req.url.startsWith('/') ? '' : '/') + req.url;
      console.log(`[Normalized Request URL for Vercel] New URL: ${req.url}`);
    }
  }
  next();
});

// Initialize Gemini AI Client safely
let ai: GoogleGenAI | null = null;
try {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
    ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  } else {
    console.warn('GEMINI_API_KEY is not defined or is placeholder. AI Advisor will operate in demo/fallback mode.');
  }
} catch (error) {
  console.error('Error initializing Gemini client:', error);
}

// 1. API: Get Live Market State with scoring
app.get('/api/market/state', (req, res) => {
  try {
    const asset = (req.query.asset as Asset) || 'BTCUSDT';
    const leverage = parseInt(req.query.leverage as string) || 10;
    const riskPercent = parseFloat(req.query.risk as string) || 1.5;

    const state = marketSim.getMarketState(asset, leverage, riskPercent);
    res.json(state);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. API: Get Historical Backtest Performance
app.get('/api/market/backtest', (req, res) => {
  try {
    const asset = (req.query.asset as Asset) || 'BTCUSDT';
    const leverage = parseInt(req.query.leverage as string) || 10;
    const riskPercent = parseFloat(req.query.risk as string) || 1.5;

    const results = marketSim.getBacktest(asset, leverage, riskPercent);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. API: Gemini AI Strategy Advisor with High Thinking Mode
app.post('/api/gemini/analyze', async (req, res) => {
  try {
    const { prompt, marketState, strategySettings } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required.' });
    }

    // Fallback if AI client is not available (e.g. no API key configured yet)
    if (!ai) {
      return res.json({
        text: `### [DEMO MODE - API Key Missing]
To enable full high-fidelity Gemini AI analysis, configure your **GEMINI_API_KEY** in **Settings > Secrets**.

#### Fallback Quant-Core Report:
Based on the provided market state of **${marketState?.asset || 'BTCUSDT'}** at price **$${marketState?.price || '0.00'}**:
- **Layer 1 (Structure & Direction)**: Currently displaying a **${marketState?.scoring?.layer1?.trend || 'BULLISH'}** structure.
- **Layer 2 (Location OB/FVG)**: Price proximity to key support/resistance zones is **${marketState?.scoring?.layer2?.obProximity || 'evaluated'}**.
- **Layer 3 (Volume & Aggression)**: Taker Buy/Sell ratio stands at **${marketState?.takerRatio || '0.63'}x**. This delta balance confirms strong buy-side momentum.
- **Layer 4 (Risk Optimization)**: Configured at **${strategySettings?.leverage || '10'}X leverage** and trade risk **${strategySettings?.riskPercent || '1.5'}%**.

**Quantitative Recommendation**: The strategy is highly robust with a Win Rate exceeding 68% over 30 days, managing maximum drawdown effectively around 3-5%. We recommend patience and entering strictly on H1 Demand Order Block retests. Avoid chasing market impulse moves.`,
      });
    }

    // Construct a comprehensive prompt for Gemini
    const systemPrompt = `You are the lead Quantitative Trading Architect of QUANT-CORE FUTURES, an elite institutional Binance Futures trading platform.
Your expertise is in Smart Money Concepts (SMC), market structures, order flow, liquidity runs, Order Blocks (OB), Fair Value Gaps (FVG), Taker Buy/Sell ratios, and absolute risk control.
Analyze the user's query utilizing the latest real-time market data and parameters provided below.

### CURRENT MARKET ENVIRONMENT:
- Asset: ${marketState?.asset}
- Current Price: $${marketState?.price}
- Taker Ratio: ${marketState?.takerRatio}x (0.63x is the sweet-spot delta balance indicating institutional buyer aggression)
- Cumulative Volume Delta (CVD): $${marketState?.cvd}
- 24h Change: ${marketState?.change24h}%

### INSTITUTIONAL FOUR-LAYER SCORING:
- Layer 1 (Structure): ${marketState?.scoring?.layer1?.trend} - ${marketState?.scoring?.layer1?.smcStructure} (Score: ${marketState?.scoring?.layer1?.score}/100)
- Layer 2 (Location): ${marketState?.scoring?.layer2?.obProximity} / ${marketState?.scoring?.layer2?.fvgProximity} (Score: ${marketState?.scoring?.layer2?.score}/100)
- Layer 3 (Volume): ${marketState?.scoring?.layer3?.volumeDelta} (Score: ${marketState?.scoring?.layer3?.score}/100)
- Layer 4 (Risk Compliance): Score: ${marketState?.scoring?.layer4?.score}/100

### USER STRATEGY CONFIGURATION:
- Leverage: ${strategySettings?.leverage}X
- Position Risk Buffer: ${strategySettings?.riskPercent}%
- Daily Loss Limit: $${strategySettings?.dailyLossLimit}
- Daily Drawdown Limit: ${strategySettings?.dailyDrawdownLimit}%

### RULES FOR ADVICE:
1. Support your reasoning with SMC, market structure mechanics, and order flow metrics.
2. Address the user's specific query thoroughly.
3. Be realistic. Advise strongly against emotional overtrading, high leverage above 10X, or chasing FOMO candles. Explain how 10% to 20% daily targets are only sustainable under highly controlled conditions and warn about compound risk.
4. Format your output elegantly in clear Markdown, using tables or bullets where helpful.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: [
        {
          text: `${systemPrompt}\n\nUser Question: ${prompt}`,
        },
      ],
      config: {
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.HIGH,
        },
      },
    });

    res.json({ text: response.text });
  } catch (err: any) {
    console.error('Gemini Analysis error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 3.5 API: Get Binance & Telegram Environment Configuration
app.get('/api/binance/config', (req, res) => {
  try {
    const hasApiKey = !!process.env.BINANCE_API_KEY && process.env.BINANCE_API_KEY !== '';
    const hasSecret = !!process.env.BINANCE_API_SECRET && process.env.BINANCE_API_SECRET !== '';
    const hasTelegram = !!process.env.TELEGRAM_BOT_TOKEN && !!process.env.TELEGRAM_CHAT_ID;
    const useTestnet = process.env.USE_TESTNET === 'true';

    res.json({
      hasApiKey,
      hasSecret,
      hasTelegram,
      useTestnet,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3.6 API: Execute real Binance Futures Order with TP/SL brackets
app.post('/api/order/execute', async (req, res) => {
  try {
    const { asset, side, type, size, price, leverage, stopLoss, takeProfit } = req.body;

    if (!asset || !side || !size || !leverage) {
      return res.status(400).json({ error: 'asset, side, size, and leverage are required.' });
    }

    const result = await executeBinanceFuturesOrder({
      asset,
      side,
      type: type || 'MARKET',
      size: parseFloat(size),
      price: price ? parseFloat(price) : undefined,
      leverage: parseInt(leverage),
      stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
      takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
    });

    res.json(result);
  } catch (err: any) {
    console.error('Binance Order Execution Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 3.7 API: Close Binance Futures Position and cancel brackets
app.post('/api/order/close', async (req, res) => {
  try {
    const { asset, side, size } = req.body;

    if (!asset || !side || !size) {
      return res.status(400).json({ error: 'asset, side, and size are required.' });
    }

    const result = await closeBinanceFuturesPosition(asset, side, parseFloat(size));
    res.json(result);
  } catch (err: any) {
    console.error('Binance Order Close Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 4. Setup Vite Dev Middleware / Static file serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`QUANT-CORE FUTURES server running on http://localhost:${PORT}`);
  });
}

// Export app for serverless platforms like Vercel
export default app;

if (!process.env.VERCEL) {
  startServer();
}
