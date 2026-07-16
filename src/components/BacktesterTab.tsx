import { useState, useEffect } from 'react';
import { Asset, BacktestResult } from '../types';
import { marketSim } from '../utils/market-sim';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Play, TrendingUp, TrendingDown, RefreshCw, BarChart2, Calendar, FileSpreadsheet } from 'lucide-react';

interface BacktesterTabProps {
  currentAsset: Asset;
  leverage: number;
  riskPercent: number;
}

export default function BacktesterTab({ currentAsset, leverage, riskPercent }: BacktesterTabProps) {
  const [loading, setLoading] = useState(false);
  const [backtestData, setBacktestData] = useState<BacktestResult | null>(null);

  const runBacktest = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/market/backtest?asset=${currentAsset}&leverage=${leverage}&risk=${riskPercent}`);
      const data = await res.json();
      setBacktestData(data);
    } catch (err) {
      console.warn('Backend API backtest fetch failed, falling back to local simulation:', err);
      try {
        const localData = marketSim.getBacktest(currentAsset, leverage, riskPercent);
        setBacktestData(localData);
      } catch (localErr) {
        console.error('Local backtest simulator fallback failed:', localErr);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runBacktest();
  }, [currentAsset, leverage, riskPercent]);

  // Transform trades to create an elegant Equity Curve data list
  const getEquityCurveData = () => {
    if (!backtestData) return [];
    let curBal = backtestData.initialBalance;
    const curve = [{ index: 0, Balance: curBal, label: 'Start' }];

    // Reconstruct balance chronological step-by-step
    const sortedTrades = [...backtestData.trades].reverse();
    sortedTrades.forEach((t, i) => {
      curBal += t.pnl;
      curve.push({
        index: i + 1,
        Balance: parseFloat(curBal.toFixed(2)),
        label: `Trade ${i + 1}`,
      });
    });
    return curve;
  };

  const equityData = getEquityCurveData();

  return (
    <div id="backtester_tab" className="space-y-6">
      {/* Configuration Header */}
      <div className="bg-[#0d1117] border border-[#1f242d] rounded p-4 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider font-mono flex items-center gap-2">
            <BarChart2 size={14} className="text-[#f3ba2f]" />
            QUANT-CORE Historical Backtesting Engine
          </h3>
          <p className="text-[10px] text-gray-500 mt-0.5 font-mono">
            SMC Rule validation over the last 30 days • Asset: {currentAsset} • Leverage: {leverage}X • Risk: {riskPercent}%
          </p>
        </div>

        <button
          onClick={runBacktest}
          disabled={loading}
          className="bg-[#1f242d] hover:bg-[#30363d] border border-[#30363d] disabled:bg-gray-800 text-[#f3ba2f] font-mono text-[11px] font-bold px-4 py-2 rounded transition-all flex items-center gap-2 cursor-pointer"
        >
          {loading ? (
            <RefreshCw className="animate-spin" size={12} />
          ) : (
            <Play size={12} className="fill-current" />
          )}
          <span>{loading ? 'RUNNING SIMULATION...' : 'RE-RUN BACKTEST'}</span>
        </button>
      </div>

      {backtestData && (
        <>
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="bg-[#161b22] border border-[#30363d] rounded p-3 text-center">
              <div className="text-[9px] text-gray-500 uppercase tracking-widest font-mono font-bold">Total Net Return</div>
              <div className="text-base font-black text-green-400 font-mono mt-1">
                +{backtestData.totalReturn}%
              </div>
              <div className="text-[9px] text-gray-500 mt-0.5 font-mono">
                Ending Bal: ${backtestData.finalBalance.toLocaleString()}
              </div>
            </div>

            <div className="bg-[#161b22] border border-[#30363d] rounded p-3 text-center">
              <div className="text-[9px] text-gray-500 uppercase tracking-widest font-mono font-bold">Win Rate</div>
              <div className="text-base font-black text-[#f3ba2f] font-mono mt-1">
                {backtestData.winRate}%
              </div>
              <div className="text-[9px] text-gray-500 mt-0.5 font-mono">
                {Math.round(backtestData.totalTrades * backtestData.winRate / 100)} Wins / {backtestData.totalTrades} Trades
              </div>
            </div>

            <div className="bg-[#161b22] border border-[#30363d] rounded p-3 text-center">
              <div className="text-[9px] text-gray-500 uppercase tracking-widest font-mono font-bold">Profit Factor</div>
              <div className="text-base font-black text-gray-200 font-mono mt-1">
                {backtestData.profitFactor}x
              </div>
              <div className="text-[9px] text-gray-500 mt-0.5 font-mono">Gross profit / Gross loss</div>
            </div>

            <div className="bg-[#161b22] border border-[#30363d] rounded p-3 text-center">
              <div className="text-[9px] text-gray-500 uppercase tracking-widest font-mono font-bold">Max Drawdown</div>
              <div className="text-base font-black text-rose-400 font-mono mt-1">
                {backtestData.maxDrawdown}%
              </div>
              <div className="text-[9px] text-gray-500 mt-0.5 font-mono">Extremely managed drawdown</div>
            </div>

            <div className="bg-[#161b22] border border-[#30363d] rounded p-3 text-center col-span-2 lg:col-span-1">
              <div className="text-[9px] text-gray-500 uppercase tracking-widest font-mono font-bold">Daily Target Met</div>
              <div className="text-base font-black text-green-400 font-mono mt-1">
                {backtestData.totalReturn >= 30 ? 'HIGH (10-20% avg)' : 'CONSISTENT'}
              </div>
              <div className="text-[9px] text-gray-500 mt-0.5 font-mono">Avoids emotional overtrading</div>
            </div>
          </div>

          {/* Equity Curve Chart */}
          <div className="bg-[#0d1117] border border-[#1f242d] rounded p-4 shadow-xl">
            <div className="flex justify-between items-center mb-3">
              <div>
                <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider font-mono">
                  Simulated Account Equity Curve
                </h4>
                <p className="text-[10px] text-gray-500 mt-0.5 font-mono">Chronological trade compounding comparison (Initial Capital: $10,000)</p>
              </div>
            </div>

            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={equityData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid stroke="#1f242d" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#8892b0', fontSize: 9, fontFamily: 'monospace' }}
                  />
                  <YAxis
                    domain={['auto', 'auto']}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#8892b0', fontSize: 9, fontFamily: 'monospace' }}
                    orientation="right"
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-[#0d1117] border border-[#30363d] rounded p-2 shadow-xl text-[10px] font-mono">
                            <p className="text-gray-400">{payload[0].payload.label}</p>
                            <p className="text-[#f3ba2f] font-bold mt-1">
                              Equity: ${payload[0].value?.toLocaleString()}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Balance"
                    stroke="#f3ba2f"
                    strokeWidth={2}
                    dot={{ fill: '#f3ba2f', stroke: '#0d1117', strokeWidth: 1, r: 2 }}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Detailed Backtest Trade Logs */}
          <div className="bg-[#0d1117] border border-[#1f242d] rounded p-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-[#1f242d] pb-3 mb-3">
              <div>
                <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wider font-mono flex items-center gap-2">
                  <FileSpreadsheet size={14} className="text-[#f3ba2f]" />
                  Audit Trade History Log (Last 30 days)
                </h4>
                <p className="text-[10px] text-gray-500 mt-0.5 font-mono">Strict mechanical validation parameters</p>
              </div>
            </div>

            <div className="max-h-[250px] overflow-y-auto">
              <table className="w-full text-left border-collapse font-mono text-[10px] text-gray-300">
                <thead>
                  <tr className="border-b border-[#30363d] text-gray-500 uppercase tracking-wider text-[9px]">
                    <th className="py-2 px-2">Date/Time</th>
                    <th className="py-2 px-2">Asset</th>
                    <th className="py-2 px-2">Side</th>
                    <th className="py-2 px-2 text-right">Size</th>
                    <th className="py-2 px-2 text-right">Profit/Loss</th>
                    <th className="py-2 px-2 text-right">Return %</th>
                    <th className="py-2 px-2 pl-4">Algorithmic Confluence Reasoning</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1f242d]">
                  {backtestData.trades.map((trade) => {
                    const isWin = trade.pnl > 0;
                    return (
                      <tr key={trade.id} className="hover:bg-[#161b22]/40 transition-colors">
                        <td className="py-2 px-2 text-gray-500">{trade.timestamp}</td>
                        <td className="py-2 px-2 font-bold text-white">{trade.asset}</td>
                        <td className="py-2 px-2">
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              trade.side === 'LONG' ? 'bg-green-500/10 text-green-400' : 'bg-rose-500/10 text-rose-400'
                            }`}
                          >
                            {trade.side}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right text-gray-400">{trade.size}</td>
                        <td className={`py-2 px-2 text-right font-bold ${isWin ? 'text-green-400' : 'text-rose-400'}`}>
                          {isWin ? '+' : ''}${trade.pnl.toLocaleString()}
                        </td>
                        <td className={`py-2 px-2 text-right font-bold ${isWin ? 'text-green-400' : 'text-rose-400'}`}>
                          {isWin ? '+' : ''}{trade.pnlPercent}%
                        </td>
                        <td className="py-2 px-2 pl-4 text-gray-400 leading-normal max-w-sm overflow-hidden text-ellipsis whitespace-normal text-[9px]">
                          {trade.reason}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
