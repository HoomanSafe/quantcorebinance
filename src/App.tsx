import { useState, useEffect, useRef } from 'react';
import { Asset, MarketState, AccountState, Position, TradeLog } from './types';
import CandlestickChart from './components/CandlestickChart';
import ScoringArchitecturePanel from './components/ScoringArchitecturePanel';
import AIAdvisorPanel from './components/AIAdvisorPanel';
import OrderTerminal from './components/OrderTerminal';
import PositionTable from './components/PositionTable';
import BacktesterTab from './components/BacktesterTab';
import {
  TrendingUp,
  Wallet,
  Activity,
  History,
  ShieldCheck,
  ShieldAlert,
  Menu,
  ChevronRight,
  RefreshCw,
  Clock,
  ExternalLink,
} from 'lucide-react';

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<'TERMINAL' | 'BACKTESTER' | 'HISTORY'>('TERMINAL');

  // Selected asset
  const [currentAsset, setCurrentAsset] = useState<Asset>('BTCUSDT');

  // Live market state
  const [marketState, setMarketState] = useState<MarketState | null>(null);
  const [loadingMarket, setLoadingMarket] = useState(true);

  // Binance Live trading integration states
  const [binanceConfig, setBinanceConfig] = useState<{
    hasApiKey: boolean;
    hasSecret: boolean;
    hasTelegram: boolean;
    useTestnet: boolean;
  } | null>(null);
  const [executionMode, setExecutionMode] = useState<'SIMULATED' | 'REAL'>('SIMULATED');

  // Balance settings modal
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [inputBalance, setInputBalance] = useState('10000');

  // Fetch Binance API & Telegram Configuration from backend
  useEffect(() => {
    const fetchBinanceConfig = async () => {
      try {
        const res = await fetch('/api/binance/config');
        const data = await res.json();
        setBinanceConfig(data);
        if (data.hasApiKey && data.hasSecret) {
          setExecutionMode('REAL');
        }
      } catch (err) {
        console.error('Failed to load Binance config:', err);
      }
    };
    fetchBinanceConfig();
  }, []);

  // Paper trading wallet state
  const [account, setAccount] = useState<AccountState>({
    walletBalance: 10000,
    marginBalance: 10000,
    availableBalance: 10000,
    unrealizedPnl: 0,
    positions: [],
    tradeHistory: [],
    dailyDrawdownLimit: 5.0, // 5% max drawdown
    dailyLossLimit: 500, // $500 max loss
    dailyStartBalance: 10000,
    leverage: 10,
    riskPercent: 1.5,
  });

  // Track server-side updates
  const tickRef = useRef<number>(0);

  // Load account state from localStorage on init
  useEffect(() => {
    const saved = localStorage.getItem('quantcore_account_v1');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Ensure standard fields
        setAccount((prev) => ({
          ...prev,
          ...parsed,
        }));
      } catch (e) {
        console.error('Failed to parse account state:', e);
      }
    }
  }, []);

  // Save account state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('quantcore_account_v1', JSON.stringify(account));
  }, [account]);

  // Fetch live market state every 3 seconds
  useEffect(() => {
    const fetchState = async () => {
      try {
        const res = await fetch(
          `/api/market/state?asset=${currentAsset}&leverage=${account.leverage}&risk=${account.riskPercent}`
        );
        if (!res.ok) {
          throw new Error(`HTTP Error: ${res.status}`);
        }
        const data: MarketState = await res.json();
        setMarketState(data);
        setLoadingMarket(false);
      } catch (err) {
        console.error('Error loading market state:', err);
        setLoadingMarket(false);
      }
    };

    fetchState();
    const interval = setInterval(fetchState, 3000);
    return () => clearInterval(interval);
  }, [currentAsset, account.leverage, account.riskPercent]);

  // Real-time Position Price updating loop
  // Runs whenever market price of current asset changes to compute unrealized PnL & evaluate stop-loss/take-profit triggers!
  useEffect(() => {
    if (!marketState) return;

    setAccount((prev) => {
      let totalUnrealizedPnl = 0;
      let closedTrades: TradeLog[] = [];
      let updatedPositions = prev.positions.map((pos) => {
        if (pos.asset !== marketState.asset) {
          totalUnrealizedPnl += pos.unrealizedPnl;
          return pos;
        }

        const currentPrice = marketState.price;
        const priceDiff = pos.side === 'LONG' ? currentPrice - pos.entryPrice : pos.entryPrice - currentPrice;
        const unrealizedPnl = parseFloat((pos.size * priceDiff).toFixed(2));
        const pnlPercent = parseFloat(((unrealizedPnl / pos.margin) * 100).toFixed(2));

        // Evaluate Stop Loss / Take Profit triggers
        const triggerSL = pos.stopLoss
          ? pos.side === 'LONG'
            ? currentPrice <= pos.stopLoss
            : currentPrice >= pos.stopLoss
          : false;

        const triggerTP = pos.takeProfit
          ? pos.side === 'LONG'
            ? currentPrice >= pos.takeProfit
            : currentPrice <= pos.takeProfit
          : false;

        if (triggerSL || triggerTP) {
          const exitPrice = triggerSL ? pos.stopLoss! : pos.takeProfit!;
          const finalPriceDiff = pos.side === 'LONG' ? exitPrice - pos.entryPrice : pos.entryPrice - exitPrice;
          const finalPnl = parseFloat((pos.size * finalPriceDiff).toFixed(2));

          closedTrades.push({
            id: `trade-closed-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            asset: pos.asset,
            side: pos.side,
            entryPrice: pos.entryPrice,
            exitPrice,
            size: pos.size,
            leverage: pos.leverage,
            pnl: finalPnl,
            pnlPercent: parseFloat(((finalPnl / pos.margin) * 100).toFixed(2)),
            timestamp: new Date().toLocaleTimeString() + ' (Automated Execution)',
            reason: triggerSL
              ? 'Institutional Stop Loss triggered. Risk bounds verified & preserved capital.'
              : 'Institutional Take Profit target achieved. Standard Reward-to-Risk target met.',
          });

          return null; // remove position
        }

        totalUnrealizedPnl += unrealizedPnl;
        return {
          ...pos,
          currentPrice,
          unrealizedPnl,
          pnlPercent,
        };
      }).filter((p): p is Position => p !== null);

      // Apply closed trades balance impacts
      let netWalletDiff = closedTrades.reduce((sum, t) => sum + t.pnl, 0);
      const newWalletBal = parseFloat((prev.walletBalance + netWalletDiff).toFixed(2));

      // Compute margins
      const totalMarginUsed = updatedPositions.reduce((sum, p) => sum + p.margin, 0);
      const newMarginBal = parseFloat((newWalletBal + totalUnrealizedPnl).toFixed(2));
      const newAvailableBal = parseFloat((newMarginBal - totalMarginUsed).toFixed(2));

      return {
        ...prev,
        walletBalance: newWalletBal,
        marginBalance: newMarginBal,
        availableBalance: newAvailableBal,
        unrealizedPnl: parseFloat(totalUnrealizedPnl.toFixed(2)),
        positions: updatedPositions,
        tradeHistory: [...closedTrades, ...prev.tradeHistory],
      };
    });
  }, [marketState?.price]);

  // Handle placing a new position (handles both simulated paper trades and real Binance executions)
  const handleAddPosition = async (newPosData: Omit<Position, 'id' | 'currentPrice' | 'unrealizedPnl' | 'pnlPercent' | 'margin'>) => {
    let entryPrice = newPosData.entryPrice;
    let isReal = false;
    let binanceOrderId = '';
    let slOrderId = '';
    let tpOrderId = '';

    if (executionMode === 'REAL') {
      try {
        const response = await fetch('/api/order/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            asset: newPosData.asset,
            side: newPosData.side,
            type: 'MARKET',
            size: newPosData.size,
            price: newPosData.entryPrice,
            leverage: newPosData.leverage,
            stopLoss: newPosData.stopLoss,
            takeProfit: newPosData.takeProfit,
          }),
        });

        const result = await response.json();
        if (!response.ok) {
          alert(`Binance Execution Error: ${result.error || 'Unknown Error'}`);
          return;
        }

        isReal = true;
        binanceOrderId = result.entryOrderId;
        slOrderId = result.slOrderId;
        tpOrderId = result.tpOrderId;
        entryPrice = result.actualEntryPrice || entryPrice;

        alert(`AUTOMATED ORDER FILLED ON BINANCE!\n\n- Symbol: ${newPosData.asset}\n- Entry Price: $${entryPrice}\n- SL Target: ${newPosData.stopLoss ? '$' + newPosData.stopLoss : 'None'}\n- TP Target: ${newPosData.takeProfit ? '$' + newPosData.takeProfit : 'None'}\n- Telegram Alert dispatched successfully.`);
      } catch (err: any) {
        console.error('Error executing Binance order:', err);
        alert(`Failed to execute order on Binance: ${err.message}`);
        return;
      }
    }

    const margin = parseFloat(((newPosData.size * entryPrice) / newPosData.leverage).toFixed(2));

    const newPosition: Position = {
      ...newPosData,
      id: `pos-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      entryPrice,
      currentPrice: entryPrice,
      unrealizedPnl: 0,
      pnlPercent: 0,
      margin,
      isReal,
      binanceOrderId,
      slOrderId,
      tpOrderId,
    };

    setAccount((prev) => {
      const positions = [...prev.positions, newPosition];
      const totalMarginUsed = positions.reduce((sum, p) => sum + p.margin, 0);
      const marginBalance = parseFloat((prev.walletBalance + prev.unrealizedPnl).toFixed(2));
      const availableBalance = parseFloat((marginBalance - totalMarginUsed).toFixed(2));

      return {
        ...prev,
        positions,
        availableBalance,
      };
    });
  };

  // Close position manually (handles simulated and real Binance closing)
  const handleClosePosition = async (id: string) => {
    const posToClose = account.positions.find((p) => p.id === id);
    if (!posToClose) return;

    if (posToClose.isReal) {
      const confirmClose = window.confirm(`Confirm PANIC MARKET CLOSE for real Binance position: ${posToClose.asset}?\nThis will cancel all open SL/TP bracket orders and fully square the position.`);
      if (!confirmClose) return;

      try {
        const response = await fetch('/api/order/close', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            asset: posToClose.asset,
            side: posToClose.side,
            size: posToClose.size,
          }),
        });

        const result = await response.json();
        if (!response.ok) {
          alert(`Binance Close Error: ${result.error || 'Unknown Error'}`);
          return;
        }

        alert(`Real position for ${posToClose.asset} closed on Binance. Bracket orders cancelled.`);
      } catch (err: any) {
        console.error('Error closing real position:', err);
        alert(`Failed to close position on Binance: ${err.message}`);
        return;
      }
    }

    setAccount((prev) => {
      const pos = prev.positions.find((p) => p.id === id);
      if (!pos) return prev;

      const finalPrice = marketState?.asset === pos.asset ? marketState.price : pos.currentPrice;
      const priceDiff = pos.side === 'LONG' ? finalPrice - pos.entryPrice : pos.entryPrice - finalPrice;
      const finalPnl = parseFloat((pos.size * priceDiff).toFixed(2));

      const log: TradeLog = {
        id: `trade-close-${Date.now()}`,
        asset: pos.asset,
        side: pos.side,
        entryPrice: pos.entryPrice,
        exitPrice: finalPrice,
        size: pos.size,
        leverage: pos.leverage,
        pnl: finalPnl,
        pnlPercent: parseFloat(((finalPnl / pos.margin) * 100).toFixed(2)),
        timestamp: new Date().toLocaleTimeString() + (pos.isReal ? ' (Real Close)' : ' (Simulated Close)'),
        reason: pos.isReal
          ? 'Real Binance position squared. Bracket orders cancelled.'
          : 'Manual structural close. Profit secured or loss minimized by user action.',
      };

      const positions = prev.positions.filter((p) => p.id !== id);
      const newWalletBal = parseFloat((prev.walletBalance + finalPnl).toFixed(2));
      const totalMarginUsed = positions.reduce((sum, p) => sum + p.margin, 0);
      const totalUnrealizedPnl = positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
      const marginBalance = parseFloat((newWalletBal + totalUnrealizedPnl).toFixed(2));
      const availableBalance = parseFloat((marginBalance - totalMarginUsed).toFixed(2));

      return {
        ...prev,
        walletBalance: newWalletBal,
        marginBalance,
        availableBalance,
        unrealizedPnl: totalUnrealizedPnl,
        positions,
        tradeHistory: [log, ...prev.tradeHistory],
      };
    });
  };

  const handleUpdateAccount = (updated: Partial<AccountState>) => {
    setAccount((prev) => ({
      ...prev,
      ...updated,
    }));
  };

  const handleSetBalance = (amount: number) => {
    setAccount((prev) => {
      const positions = prev.positions;
      const totalMarginUsed = positions.reduce((sum, p) => sum + p.margin, 0);
      const totalUnrealizedPnl = positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
      const marginBalance = parseFloat((amount + totalUnrealizedPnl).toFixed(2));
      const availableBalance = parseFloat((marginBalance - totalMarginUsed).toFixed(2));

      return {
        ...prev,
        walletBalance: amount,
        marginBalance,
        availableBalance,
        dailyStartBalance: amount,
      };
    });
    setShowBalanceModal(false);
  };

  // Reset wallet to initial balance
  const handleResetWallet = () => {
    if (window.confirm('Reset simulated paper trading account to $10,000 USDT?')) {
      setAccount({
        walletBalance: 10000,
        marginBalance: 10000,
        availableBalance: 10000,
        unrealizedPnl: 0,
        positions: [],
        tradeHistory: [],
        dailyDrawdownLimit: 5.0,
        dailyLossLimit: 500,
        dailyStartBalance: 10000,
        leverage: 10,
        riskPercent: 1.5,
      });
    }
  };

  // Calculate stats
  const dailyPnL = parseFloat((account.walletBalance - account.dailyStartBalance).toFixed(2));
  const dailyPnLPercent = parseFloat(((dailyPnL / account.dailyStartBalance) * 100).toFixed(2));
  const currentDrawdown = parseFloat(
    Math.max(0, ((account.dailyStartBalance - account.marginBalance) / account.dailyStartBalance) * 100).toFixed(2)
  );

  const isDrawdownAlert = currentDrawdown >= account.dailyDrawdownLimit * 0.8;
  const isLossLimitAlert = dailyPnL <= -account.dailyLossLimit;

  return (
    <div className="min-h-screen bg-[#0a0c10] text-[#e1e4e8] font-sans flex flex-col antialiased">
      {/* TOP NAVIGATION BAR */}
      <header className="h-14 border-b border-[#1f242d] flex items-center justify-between px-6 bg-[#0d1117] sticky top-0 z-30">
        <div className="flex items-center space-x-4">
          <div className="w-8 h-8 bg-[#f3ba2f] rounded flex items-center justify-center shrink-0">
            <div className="w-4 h-4 border-2 border-[#0a0c10] rotate-45"></div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm md:text-base font-bold tracking-tight uppercase font-display text-white">
                Quant-Core <span className="text-[#f3ba2f]">Futures</span>
              </h1>
              <span className="text-[9px] font-bold font-mono bg-purple-500/10 border border-purple-500/20 text-purple-400 px-1 py-0.2 rounded">
                v1.2-PRO
              </span>
            </div>
            <p className="text-[9px] text-gray-500 font-mono tracking-widest uppercase">
              SYSTEM ID: QC-882-ULTRA
            </p>
          </div>
        </div>

        {/* Live Feed Status */}
        <div className="flex items-center space-x-6">
          <div className="hidden md:flex flex-col items-end">
            <span className="text-[9px] text-gray-500 uppercase font-semibold font-mono">Connection Status</span>
            <span className="text-xs text-green-400 font-mono flex items-center">
              <span className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></span>
              BINANCE LIVE FEED (0.4ms)
            </span>
          </div>
          <div className="h-8 w-px bg-[#1f242d] hidden md:block"></div>
          <button
            onClick={() => {
              if (executionMode === 'SIMULATED') {
                if (binanceConfig && binanceConfig.hasApiKey && binanceConfig.hasSecret) {
                  setExecutionMode('REAL');
                } else {
                  alert(
                    "BINANCE REAL TRADING LOCKED\n\nNo Binance API keys detected in your environment. Please set BINANCE_API_KEY and BINANCE_API_SECRET in your Vercel or local environment secrets to unlock live trading."
                  );
                }
              } else {
                setExecutionMode('SIMULATED');
              }
            }}
            className={`px-3 py-1 rounded text-xs border font-mono flex items-center gap-1.5 transition-all cursor-pointer ${
              executionMode === 'REAL'
                ? 'bg-amber-500/10 border-amber-500/35 text-amber-400 hover:bg-amber-500/20'
                : 'bg-blue-500/10 border-blue-500/25 text-blue-400 hover:bg-blue-500/20'
            }`}
            title="Click to toggle trading mode"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${
              executionMode === 'REAL' ? 'bg-amber-400 animate-pulse' : 'bg-blue-400 animate-pulse'
            }`}></span>
            MODE: <span className="font-extrabold uppercase">{executionMode}</span>
          </button>
          <button
            onClick={() => {
              setInputBalance(account.walletBalance.toString());
              setShowBalanceModal(true);
            }}
            className="text-[10px] bg-[#161b22] border border-[#30363d] hover:border-[#f3ba2f]/50 text-[#f3ba2f] hover:text-white px-2.5 py-1 rounded transition-all font-mono uppercase"
          >
            Set Balance
          </button>
          <button
            onClick={handleResetWallet}
            className="text-[10px] bg-[#161b22] border border-[#30363d] hover:border-yellow-500/40 text-gray-400 hover:text-white px-2.5 py-1 rounded transition-all font-mono uppercase"
          >
            Reset
          </button>
        </div>
      </header>

      {/* Primary Sub-Header / Control bar */}
      <nav className="border-b border-[#1f242d] bg-[#0c0d12] px-6 py-2">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          {/* Navigation Tabs */}
          <div className="flex gap-1 bg-[#0d1117] border border-[#1f242d] p-1 rounded">
            <button
              onClick={() => setActiveTab('TERMINAL')}
              className={`px-3 py-1 rounded font-mono text-[11px] font-bold tracking-wider uppercase transition-all flex items-center gap-1.5 ${
                activeTab === 'TERMINAL' ? 'bg-[#1f242d] text-[#f3ba2f]' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <Activity size={12} />
              <span>Live Terminal</span>
            </button>
            <button
              onClick={() => setActiveTab('BACKTESTER')}
              className={`px-3 py-1 rounded font-mono text-[11px] font-bold tracking-wider uppercase transition-all flex items-center gap-1.5 ${
                activeTab === 'BACKTESTER' ? 'bg-[#1f242d] text-[#f3ba2f]' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <History size={12} />
              <span>Backtest Suite</span>
            </button>
            <button
              onClick={() => setActiveTab('HISTORY')}
              className={`px-3 py-1 rounded font-mono text-[11px] font-bold tracking-wider uppercase transition-all flex items-center gap-1.5 ${
                activeTab === 'HISTORY' ? 'bg-[#1f242d] text-[#f3ba2f]' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <Clock size={12} />
              <span>Session Logs ({account.tradeHistory.length})</span>
            </button>
          </div>

          {/* Quick Portfolio Stats */}
          <div className="flex flex-wrap items-center gap-4 bg-[#161b22] border border-[#30363d] rounded px-3 py-1 text-xs font-mono">
            {/* Wallet Balance */}
            <div className="flex items-center gap-2">
              <Wallet size={12} className="text-[#f3ba2f]" />
              <div className="flex items-baseline gap-1.5">
                <span className="text-[10px] text-gray-500 uppercase">Equity:</span>
                <span className="text-xs font-bold text-gray-100">
                  ${account.walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="h-4 w-px bg-[#1f242d]" />

            {/* Daily PnL */}
            <div className="flex items-baseline gap-1.5">
              <span className="text-[10px] text-gray-500 uppercase">Daily PnL:</span>
              <span className={`text-xs font-bold ${dailyPnL >= 0 ? 'text-green-400' : 'text-rose-400'}`}>
                {dailyPnL >= 0 ? '+' : ''}${dailyPnL.toLocaleString()} ({dailyPnLPercent}%)
              </span>
            </div>

            <div className="h-4 w-px bg-[#1f242d]" />

            {/* Daily Drawdown */}
            <div className="flex items-baseline gap-1.5">
              <span className="text-[10px] text-gray-500 uppercase">Drawdown:</span>
              <span className={`text-xs font-bold ${isDrawdownAlert ? 'text-rose-400' : 'text-green-400'}`}>
                {currentDrawdown}% <span className="text-gray-500 font-medium">/ {account.dailyDrawdownLimit}%</span>
              </span>
            </div>

            <div className="h-4 w-px bg-[#1f242d]" />

            {/* Active Guard Status */}
            <div className="flex items-center gap-1.5">
              {isLossLimitAlert || isDrawdownAlert ? (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-2 py-0.5 rounded flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider">
                  <ShieldAlert size={10} />
                  <span>Guard Breached</span>
                </div>
              ) : (
                <div className="bg-green-500/10 border border-[#2ea043]/30 text-green-400 px-2 py-0.5 rounded flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider">
                  <ShieldCheck size={10} />
                  <span>Risk Safe</span>
                </div>
              )}
              
              <div className={`px-2 py-0.5 rounded flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider border transition-all ${
                executionMode === 'REAL'
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                  : 'bg-blue-500/15 border-blue-500/25 text-blue-400'
              }`}>
                <span className="w-1 h-1 rounded-full bg-current animate-pulse"></span>
                <span>{executionMode === 'REAL' ? 'Real Futures' : 'Simulated Paper'}</span>
              </div>
            </div>
          </div>

          {/* Asset Selection */}
          <div className="flex items-center gap-2 self-stretch md:self-auto justify-between md:justify-start">
            <span className="text-[10px] uppercase tracking-widest font-semibold text-[#f3ba2f] font-mono">
              Market Index:
            </span>
            <select
              value={currentAsset}
              onChange={(e) => setCurrentAsset(e.target.value as Asset)}
              className="bg-[#161b22] border border-[#30363d] text-[#f3ba2f] text-xs font-bold font-mono px-3 py-1 rounded focus:outline-none focus:border-[#f3ba2f]/60 cursor-pointer"
            >
              {[
                'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT',
                'DOGEUSDT', 'DOTUSDT', 'MATICUSDT', 'LTCUSDT', 'SHIBUSDT', 'AVAXUSDT',
                'LINKUSDT', 'UNIUSDT', 'ATOMUSDT', 'NEARUSDT', 'APTUSDT', 'SUIUSDT',
                'OPUSDT', 'ARBUSDT'
              ].map((asset) => (
                <option key={asset} value={asset} className="bg-[#0d1117] text-gray-300 font-mono">
                  {asset.replace('USDT', '')} / USDT
                </option>
              ))}
            </select>
          </div>
        </div>
      </nav>

      {/* Main Workspace Body */}
      <main className="flex-1 px-4 py-4 max-w-7xl mx-auto w-full">
        {loadingMarket ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-24 text-gray-500">
            <RefreshCw className="animate-spin text-[#f3ba2f]" size={32} />
            <p className="text-xs font-mono uppercase tracking-wider animate-pulse">
              Synchronizing with Binance USDⓈ-M quantitative index...
            </p>
          </div>
        ) : !marketState ? (
          <div className="text-center py-24 text-rose-400 border border-rose-950/20 bg-rose-950/5 rounded p-6 font-mono text-xs">
            Failed to fetch state from backend server. Run server.ts using the dev script.
          </div>
        ) : (
          <>
            {activeTab === 'TERMINAL' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                {/* Left Area: Ticker info + Candlestick + Position Table */}
                <div className="lg:col-span-8 space-y-4 flex flex-col justify-between">
                  {/* Candle Chart panel */}
                  <CandlestickChart
                    candles={marketState.candles}
                    orderBlocks={marketState.orderBlocks}
                    fairValueGaps={marketState.fairValueGaps}
                    currentPrice={marketState.price}
                  />

                  {/* Positions panel */}
                  <PositionTable
                    positions={account.positions}
                    onClosePosition={handleClosePosition}
                  />
                </div>

                {/* Right Area: Scoring + Order terminal + AI Co-pilot */}
                <div className="lg:col-span-4 space-y-4 flex flex-col justify-between">
                  {/* Scoring Architecture Panel */}
                  <ScoringArchitecturePanel scoring={marketState.scoring} />

                  {/* Order Desk terminal */}
                  <OrderTerminal
                    marketState={marketState}
                    accountState={account}
                    onUpdateAccount={handleUpdateAccount}
                    onAddPosition={handleAddPosition}
                    executionMode={executionMode}
                    onSetExecutionMode={setExecutionMode}
                    binanceConfig={binanceConfig}
                  />

                  {/* AI Copilot Panel */}
                  <AIAdvisorPanel marketState={marketState} accountState={account} />
                </div>
              </div>
            )}

            {activeTab === 'BACKTESTER' && (
              <BacktesterTab
                currentAsset={currentAsset}
                leverage={account.leverage}
                riskPercent={account.riskPercent}
              />
            )}

            {activeTab === 'HISTORY' && (
              <div className="bg-[#161b22] border border-[#1f242d] rounded p-4 shadow-2xl">
                <div className="flex justify-between items-center border-b border-[#30363d] pb-3 mb-4">
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                      <Clock size={14} className="text-[#f3ba2f]" />
                      Platform Audit Session Logs
                    </h3>
                    <p className="text-[10px] text-gray-500 mt-0.5 font-mono">
                      Session-specific mechanical executions, order compliance & safety audit trail
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (window.confirm('Clear all session trade logs?')) {
                        handleUpdateAccount({ tradeHistory: [] });
                      }
                    }}
                    className="text-[10px] border border-rose-500/20 hover:border-rose-500/40 text-rose-400 hover:bg-rose-500/5 px-2.5 py-1 rounded transition-all font-mono uppercase tracking-wider"
                  >
                    Clear Logs
                  </button>
                </div>

                {account.tradeHistory.length === 0 ? (
                  <div className="text-center py-16 text-gray-500 font-mono text-xs uppercase tracking-wider">
                    No historic trades logged in this session.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {account.tradeHistory.map((log) => {
                      const isProfit = log.pnl > 0;
                      return (
                        <div
                          key={log.id}
                          className="bg-[#0d1117] border border-[#1f242d] rounded p-3 hover:border-gray-700 transition-all font-mono"
                        >
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">{log.asset}</span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                                  log.side === 'LONG' ? 'bg-green-500/10 text-green-400' : 'bg-rose-500/10 text-rose-400'
                                }`}
                              >
                                {log.side}
                              </span>
                              <span className="text-[10px] text-gray-500">{log.timestamp}</span>
                            </div>
                            <div className="text-right">
                              <span className={`text-xs font-bold ${isProfit ? 'text-green-400' : 'text-rose-400'}`}>
                                {isProfit ? '+' : ''}${log.pnl.toLocaleString()} ({isProfit ? '+' : ''}
                                {log.pnlPercent}%)
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[10px] text-gray-400 border-t border-[#1f242d] pt-2 mb-2">
                            <div>
                              ENTRY PRICE: <span className="text-gray-200 font-semibold">${log.entryPrice}</span>
                            </div>
                            <div>
                              EXIT PRICE: <span className="text-gray-200 font-semibold">${log.exitPrice}</span>
                            </div>
                            <div>
                              CONTRACT SIZE: <span className="text-gray-200 font-semibold">{log.size}</span>
                            </div>
                            <div>
                              LEVERAGE: <span className="text-gray-200 font-semibold">{log.leverage}X</span>
                            </div>
                          </div>

                          <p className="text-[10px] text-gray-300 leading-relaxed bg-[#0a0c10] px-2.5 py-1.5 rounded border border-[#1f242d]">
                            <span className="text-[#f3ba2f] font-bold mr-1 uppercase text-[9px]">Audit Notes:</span>
                            {log.reason}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* FOOTER STATUS BAR */}
      <footer className="h-8 bg-[#0d1117] border-t border-[#1f242d] flex items-center px-6 justify-between text-[10px] text-gray-500 font-mono uppercase mt-auto">
        <div className="flex items-center space-x-6">
          <span>Session: 04:12:44</span>
          <span>Latency: 14ms</span>
          <span>Threads: 128 Active</span>
        </div>
        <div className="flex items-center space-x-4">
          <span className="flex items-center">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2 animate-pulse"></span>
            Emotional Guard: Locked
          </span>
          <span className="text-[#f3ba2f]">V2.4.1 Stable Build</span>
        </div>
      </footer>

      {/* Balance settings modal */}
      {showBalanceModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-[#1f242d] pb-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                <Wallet size={14} className="text-[#f3ba2f]" />
                Balance Settings
              </h3>
              <button
                onClick={() => setShowBalanceModal(false)}
                className="text-gray-500 hover:text-white text-xs font-mono uppercase cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] text-gray-400 font-mono uppercase">Custom Wallet Balance (USDT)</label>
              <input
                type="number"
                value={inputBalance}
                onChange={(e) => setInputBalance(e.target.value)}
                placeholder="10000"
                className="w-full bg-[#161b22] border border-[#30363d] rounded px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-[#f3ba2f] focus:ring-1 focus:ring-[#f3ba2f]/30"
              />

              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {['1000', '5000', '10000', '50000'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setInputBalance(preset)}
                    className="py-1 rounded bg-[#161b22] border border-[#30363d] text-[10px] font-mono hover:border-[#f3ba2f]/40 text-gray-400 hover:text-white transition-all cursor-pointer"
                  >
                    ${parseInt(preset).toLocaleString()}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                {['100000', '500000'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setInputBalance(preset)}
                    className="py-1 rounded bg-[#161b22] border border-[#30363d] text-[10px] font-mono hover:border-[#f3ba2f]/40 text-gray-400 hover:text-white transition-all cursor-pointer"
                  >
                    ${parseInt(preset).toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBalanceModal(false)}
                className="flex-1 py-1.5 rounded border border-[#30363d] hover:bg-[#161b22] text-[11px] font-mono uppercase text-gray-400 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const val = parseFloat(inputBalance);
                  if (isNaN(val) || val <= 0) {
                    alert('Please enter a valid positive number');
                    return;
                  }
                  handleSetBalance(val);
                }}
                className="flex-1 py-1.5 rounded bg-[#f3ba2f] text-[#0a0c10] font-extrabold text-[11px] font-mono uppercase hover:bg-[#d49e1e] transition-all cursor-pointer"
              >
                Apply Balance
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
