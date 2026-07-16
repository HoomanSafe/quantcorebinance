export type Asset = 'BTCUSDT' | 'ETHUSDT' | 'SOLUSDT' | 'BNBUSDT';

export interface Candle {
  time: string; // HH:MM:SS or date
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OrderBlock {
  id: string;
  type: 'bullish' | 'bearish';
  priceStart: number;
  priceEnd: number;
  label: string;
  isMitigated: boolean;
}

export interface FairValueGap {
  id: string;
  type: 'bullish' | 'bearish';
  high: number;
  low: number;
  label: string;
  isMitigated: boolean;
}

export interface MarketState {
  asset: Asset;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  takerRatio: number; // e.g., 0.63
  cvd: number; // Cumulative Volume Delta
  bids: { price: number; size: number }[];
  asks: { price: number; size: number }[];
  candles: Candle[];
  orderBlocks: OrderBlock[];
  fairValueGaps: FairValueGap[];
  scoring: ScoringDetails;
}

export interface ScoringDetails {
  layer1: {
    name: string;
    description: string;
    trend: 'BULLISH' | 'BEARISH' | 'CONSOLIDATING';
    smcStructure: string; // "BOS detected", "CHoCH confirmed"
    score: number; // 0-100
    reasoning: string;
  };
  layer2: {
    name: string;
    description: string;
    obProximity: string; // "Inside Bullish OB"
    fvgProximity: string; // "Approaching FVG"
    score: number; // 0-100
    reasoning: string;
  };
  layer3: {
    name: string;
    description: string;
    takerRatio: number; // e.g., 0.63
    volumeDelta: string; // "+$1.2M Buy Delta"
    score: number; // 0-100
    reasoning: string;
  };
  layer4: {
    name: string;
    description: string;
    riskBuffersCleared: boolean;
    dailyLossBoundsActive: boolean;
    score: number; // 0-100
    reasoning: string;
  };
  aggregateScore: number; // 0-100
  signal: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
}

export interface Position {
  id: string;
  asset: Asset;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  currentPrice: number;
  size: number; // in contracts/base asset
  leverage: number;
  margin: number;
  unrealizedPnl: number;
  pnlPercent: number;
  stopLoss?: number;
  takeProfit?: number;
  isReal?: boolean;
  binanceOrderId?: string;
  slOrderId?: string;
  tpOrderId?: string;
}

export interface TradeLog {
  id: string;
  asset: Asset;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  size: number;
  leverage: number;
  pnl: number;
  pnlPercent: number;
  timestamp: string;
  reason: string;
}

export interface AccountState {
  walletBalance: number;
  marginBalance: number;
  availableBalance: number;
  unrealizedPnl: number;
  positions: Position[];
  tradeHistory: TradeLog[];
  dailyDrawdownLimit: number; // e.g., 5%
  dailyLossLimit: number; // e.g., $150
  dailyStartBalance: number;
  leverage: number; // 10X default
  riskPercent: number; // 1.5% default
}

export interface BacktestResult {
  asset: Asset;
  startDate: string;
  endDate: string;
  initialBalance: number;
  finalBalance: number;
  totalReturn: number;
  winRate: number;
  totalTrades: number;
  profitFactor: number;
  maxDrawdown: number;
  trades: TradeLog[];
}
