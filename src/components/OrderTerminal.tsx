import { useState, useEffect } from 'react';
import { MarketState, AccountState, Position } from '../types';
import { ShieldCheck, ShieldAlert, ArrowDown, ArrowUp, AlertCircle, RefreshCw } from 'lucide-react';

interface OrderTerminalProps {
  marketState: MarketState;
  accountState: AccountState;
  onUpdateAccount: (updated: Partial<AccountState>) => void;
  onAddPosition: (position: Omit<Position, 'id' | 'currentPrice' | 'unrealizedPnl' | 'pnlPercent' | 'margin'>) => void;
  executionMode: 'SIMULATED' | 'REAL';
  onSetExecutionMode: (mode: 'SIMULATED' | 'REAL') => void;
  binanceConfig: {
    hasApiKey: boolean;
    hasSecret: boolean;
    hasTelegram: boolean;
    useTestnet: boolean;
  } | null;
}

export default function OrderTerminal({
  marketState,
  accountState,
  onUpdateAccount,
  onAddPosition,
  executionMode,
  onSetExecutionMode,
  binanceConfig,
}: OrderTerminalProps) {
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [limitPrice, setLimitPrice] = useState(marketState.price.toString());
  const [useSMCStopLoss, setUseSMCStopLoss] = useState(true);
  const [stopLossPercent, setStopLossPercent] = useState('1.5'); // 1.5% risk
  const [takeProfitPercent, setTakeProfitPercent] = useState('4.5'); // 3R reward to risk (4.5%)
  const [errorMsg, setErrorMsg] = useState('');

  // Sync limit price when asset changes
  useEffect(() => {
    setLimitPrice(marketState.price.toString());
  }, [marketState.asset]);

  const entryPrice = orderType === 'MARKET' ? marketState.price : parseFloat(limitPrice) || marketState.price;
  const riskAmount = accountState.walletBalance * (accountState.riskPercent / 100);

  // Calculate Stop Loss & Take Profit prices based on side
  const calculateSLTP = (side: 'LONG' | 'SHORT') => {
    const slDist = entryPrice * (parseFloat(stopLossPercent) / 100 || 0.015);
    const tpDist = entryPrice * (parseFloat(takeProfitPercent) / 100 || 0.045);

    const stopLoss = side === 'LONG' ? entryPrice - slDist : entryPrice + slDist;
    const takeProfit = side === 'LONG' ? entryPrice + tpDist : entryPrice - tpDist;

    return {
      stopLoss: parseFloat(stopLoss.toFixed(2)),
      takeProfit: parseFloat(takeProfit.toFixed(2)),
    };
  };

  // Calculate size based on 1.5% Risk rule: size = riskAmount / SL distance
  const slDist = entryPrice * (parseFloat(stopLossPercent) / 100 || 0.015);
  const calculatedSize = parseFloat((riskAmount / slDist).toFixed(4));
  const orderMarginValue = parseFloat(((calculatedSize * entryPrice) / accountState.leverage).toFixed(2));

  const handlePlaceOrder = (side: 'LONG' | 'SHORT') => {
    setErrorMsg('');

    // Check account limits / Daily Loss Bounds
    if (accountState.walletBalance <= 5000) {
      setErrorMsg('Daily Loss Bounds active. Simulated margin buffer triggered. Trading restricted.');
      return;
    }

    if (orderMarginValue > accountState.availableBalance) {
      setErrorMsg('Insufficient available margin balance to execute order.');
      return;
    }

    const { stopLoss, takeProfit } = calculateSLTP(side);

    onAddPosition({
      asset: marketState.asset,
      side,
      entryPrice,
      size: calculatedSize,
      leverage: accountState.leverage,
      stopLoss,
      takeProfit,
    });
  };

  return (
    <div id="order_terminal" className="bg-[#0d1117] border border-[#1f242d] rounded p-4 shadow-xl flex flex-col justify-between h-full">
      <div>
        <div className="flex justify-between items-center border-b border-[#1f242d] pb-3 mb-3">
          <div>
            <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider font-mono">
              Futures Order Desk
            </h3>
            <p className="text-[10px] text-gray-500 mt-0.5 font-mono">
              {executionMode === 'REAL' ? 'Real-port algorithmic execution' : 'Binance USDⓈ-M paper-trading simulator'}
            </p>
          </div>
          <span className={`text-[9px] font-bold border px-2 py-0.5 rounded font-mono uppercase tracking-widest ${
            executionMode === 'REAL'
              ? 'text-green-400 bg-green-500/10 border-green-500/20'
              : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
          }`}>
            {executionMode === 'REAL' ? 'BINANCE REAL' : 'SIMULATION OK'}
          </span>
        </div>

        {/* Execution Mode Selector */}
        <div className="bg-[#161b22] border border-[#30363d] rounded p-3 mb-3 space-y-2">
          <div className="flex justify-between items-center text-[10px] uppercase tracking-wider text-gray-400 font-mono font-bold">
            <span>Execution Engine</span>
            <span className={executionMode === 'REAL' ? 'text-green-400 font-bold' : 'text-amber-400 font-bold'}>
              {executionMode === 'REAL' ? '● Binance Live' : '○ Paper Demo'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 p-0.5 rounded bg-[#0a0c10] border border-[#1f242d]">
            <button
              type="button"
              onClick={() => onSetExecutionMode('SIMULATED')}
              className={`py-1 rounded text-[10px] font-bold font-mono transition-all uppercase cursor-pointer ${
                executionMode === 'SIMULATED'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Simulate (Paper)
            </button>
            <button
              type="button"
              onClick={() => onSetExecutionMode('REAL')}
              className={`py-1 rounded text-[10px] font-bold font-mono transition-all uppercase cursor-pointer ${
                executionMode === 'REAL'
                  ? 'bg-green-500/10 text-green-400 border border-green-500/30 font-bold shadow'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Binance Live {(!binanceConfig || !binanceConfig.hasApiKey || !binanceConfig.hasSecret) ? '(Simulated)' : ''}
            </button>
          </div>

          {(!binanceConfig || !binanceConfig.hasApiKey || !binanceConfig.hasSecret) && (
            <div className="bg-amber-500/5 border border-amber-500/10 text-amber-400/90 text-[8.5px] px-2.5 py-1.5 rounded font-mono leading-relaxed space-y-1">
              <div className="font-bold flex items-center gap-1 uppercase text-[9px]">
                <AlertCircle size={10} className="shrink-0 text-amber-400" />
                <span>Binance Live API Offline</span>
              </div>
              <p className="text-gray-400 text-[8px] leading-tight normal-case">
                Running in <b>Simulation Mode</b>. Fills live simulated bracket orders. Add <b>BINANCE_API_KEY</b> to your secrets to unlock live funds.
              </p>
            </div>
          )}

          {binanceConfig?.hasTelegram && (
            <div className="text-[8.5px] text-gray-400 font-mono flex items-center gap-1 mt-1 bg-green-500/5 border border-green-500/10 px-1.5 py-0.5 rounded w-max">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
              <span>Telegram Bot Notifications Connected</span>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] px-3 py-2 rounded mb-3 flex items-center gap-2 font-mono leading-relaxed">
            <AlertCircle size={12} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Leverage & Risk Settings panel */}
        <div className="bg-[#161b22] border border-[#30363d] rounded p-3 space-y-3 mb-3">
          <div className="flex justify-between items-center text-[10px] uppercase tracking-wider text-gray-400 font-mono font-bold">
            <span>Risk Controls</span>
            <span className="text-[#f3ba2f]">Locked to 10X institutional bounds</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[9px] text-gray-500 mb-1 font-mono uppercase font-bold">LEVERAGE CAP</label>
              <div className="flex items-center gap-2">
                <select
                  value={accountState.leverage}
                  onChange={(e) => onUpdateAccount({ leverage: parseInt(e.target.value) })}
                  className="bg-[#0a0c10] border border-[#30363d] rounded px-2.5 py-1 text-xs text-white focus:outline-none w-full font-mono font-bold focus:border-[#f3ba2f]"
                >
                  <option value={2}>2X (Conservative)</option>
                  <option value={5}>5X (Standard)</option>
                  <option value={10}>10X (Institutional)</option>
                  <option value={15}>15X (High Risk)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[9px] text-gray-500 mb-1 font-mono uppercase font-bold">RISK PER TRADE (%)</label>
              <select
                value={accountState.riskPercent.toString()}
                onChange={(e) => onUpdateAccount({ riskPercent: parseFloat(e.target.value) })}
                className="bg-[#0a0c10] border border-[#30363d] rounded px-2.5 py-1 text-xs text-white focus:outline-none w-full font-mono font-bold focus:border-[#f3ba2f]"
              >
                <option value={0.5}>0.5% (Prop Safety)</option>
                <option value={1.0}>1.0% (Risk Clear)</option>
                <option value={1.5}>1.5% (Institutional)</option>
                <option value={2.0}>2.0% (Max Allowance)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Order Mode selector */}
        <div className="grid grid-cols-2 gap-2 mb-3 bg-[#0a0c10] p-0.5 rounded border border-[#1f242d]">
          <button
            onClick={() => setOrderType('MARKET')}
            className={`py-1 rounded text-xs font-bold font-mono transition-all uppercase ${
              orderType === 'MARKET' ? 'bg-[#1f242d] text-[#f3ba2f] border border-[#30363d]' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Market
          </button>
          <button
            onClick={() => setOrderType('LIMIT')}
            className={`py-1 rounded text-xs font-bold font-mono transition-all uppercase ${
              orderType === 'LIMIT' ? 'bg-[#1f242d] text-[#f3ba2f] border border-[#30363d]' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Limit
          </button>
        </div>

        {orderType === 'LIMIT' && (
          <div className="mb-3">
            <label className="block text-[9px] text-gray-500 mb-1 font-mono uppercase font-bold">LIMIT PRICE (USDT)</label>
            <input
              type="number"
              step="any"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              className="bg-[#0a0c10] border border-[#30363d] rounded px-3 py-1 text-xs text-white focus:outline-none w-full font-mono focus:border-[#f3ba2f]"
            />
          </div>
        )}

        {/* SL / TP inputs */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-[9px] text-gray-500 mb-1 font-mono uppercase font-bold">STOP LOSS (%)</label>
            <input
              type="number"
              step="0.1"
              value={stopLossPercent}
              onChange={(e) => setStopLossPercent(e.target.value)}
              className="bg-[#0a0c10] border border-[#30363d] rounded px-3 py-1 text-xs text-white focus:outline-none w-full font-mono focus:border-[#f3ba2f]"
            />
          </div>
          <div>
            <label className="block text-[9px] text-gray-500 mb-1 font-mono uppercase font-bold">TAKE PROFIT (%)</label>
            <input
              type="number"
              step="0.1"
              value={takeProfitPercent}
              onChange={(e) => setTakeProfitPercent(e.target.value)}
              className="bg-[#0a0c10] border border-[#30363d] rounded px-3 py-1 text-xs text-white focus:outline-none w-full font-mono focus:border-[#f3ba2f]"
            />
          </div>
        </div>

        {/* Sizing Information card */}
        <div className="bg-[#161b22] border border-[#30363d] rounded p-3 space-y-1.5 text-[10px] font-mono text-gray-400 mb-3">
          <div className="flex justify-between">
            <span>Risk Capital:</span>
            <span className="text-rose-400 font-bold">${riskAmount.toFixed(2)} ({accountState.riskPercent}%)</span>
          </div>
          <div className="flex justify-between">
            <span>Trade Position Size:</span>
            <span className="text-white font-bold">{calculatedSize} {marketState.asset.replace('USDT', '')}</span>
          </div>
          <div className="flex justify-between border-t border-[#1f242d] pt-1.5 mt-1.5">
            <span>Estimated Margin:</span>
            <span className="text-[#f3ba2f] font-bold">${orderMarginValue} USDT ({accountState.leverage}X)</span>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#1f242d]">
        <button
          onClick={() => handlePlaceOrder('LONG')}
          className="bg-[#238636] hover:bg-[#2ea043] active:scale-98 text-white py-2 rounded flex items-center justify-center gap-1.5 text-xs font-bold transition-all uppercase tracking-wider cursor-pointer"
        >
          <ArrowUp size={13} />
          <span>BUY / LONG</span>
        </button>
        <button
          onClick={() => handlePlaceOrder('SHORT')}
          className="bg-[#da3633] hover:bg-[#f85149] active:scale-98 text-white py-2 rounded flex items-center justify-center gap-1.5 text-xs font-bold transition-all uppercase tracking-wider cursor-pointer"
        >
          <ArrowDown size={13} />
          <span>SELL / SHORT</span>
        </button>
      </div>
    </div>
  );
}
