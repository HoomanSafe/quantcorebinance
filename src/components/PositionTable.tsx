import { Position } from '../types';
import { X, TrendingUp, TrendingDown, Eye } from 'lucide-react';

interface PositionTableProps {
  positions: Position[];
  onClosePosition: (id: string) => void;
}

export default function PositionTable({ positions, onClosePosition }: PositionTableProps) {
  const getPnlColor = (pnl: number) => {
    if (pnl > 0) return 'text-emerald-400';
    if (pnl < 0) return 'text-rose-400';
    return 'text-gray-400';
  };

  return (
    <div id="position_table" className="bg-[#0d1117] border border-[#1f242d] rounded p-4 shadow-xl">
      <div className="flex justify-between items-center border-b border-[#1f242d] pb-3 mb-3">
        <div>
          <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
            <Eye size={14} className="text-[#f3ba2f] animate-pulse" />
            Active Futures Positions
          </h3>
          <p className="text-[10px] text-gray-500 mt-0.5 font-mono">Real-time unrealized PnL & risk indicators</p>
        </div>
        <span className="text-[10px] bg-[#161b22] border border-[#30363d] text-gray-400 px-2.5 py-0.5 rounded font-mono">
          Total: {positions.length}
        </span>
      </div>

      {positions.length === 0 ? (
        <div className="text-center py-10 text-gray-500 font-mono text-xs uppercase tracking-wider">
          <p>No active positions found in this session.</p>
          <p className="text-[10px] text-gray-600 mt-1 uppercase tracking-widest leading-relaxed">
            Place simulated order on the Desk to test strategy metrics.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-[11px] text-gray-300">
            <thead>
              <tr className="border-b border-[#30363d] text-gray-500 uppercase tracking-wider text-[10px]">
                <th className="py-2 px-2">Asset</th>
                <th className="py-2 px-2">Side</th>
                <th className="py-2 px-2 text-right">Size</th>
                <th className="py-2 px-2 text-right">Entry</th>
                <th className="py-2 px-2 text-right">Mark Price</th>
                <th className="py-2 px-2 text-right">Margin (Lev)</th>
                <th className="py-2 px-2 text-right">Stop / TP</th>
                <th className="py-2 px-2 text-right">Unrealized PnL</th>
                <th className="py-2 px-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f242d]">
              {positions.map((pos) => {
                const isLong = pos.side === 'LONG';
                return (
                  <tr key={pos.id} className="hover:bg-[#161b22]/40 transition-colors">
                    <td className="py-2 px-2">
                      <div className="font-bold text-white">{pos.asset}</div>
                      {pos.isReal ? (
                        <div className="text-[8px] text-green-400 font-bold bg-green-500/10 border border-green-500/20 px-1 py-0.5 rounded w-max mt-0.5 uppercase tracking-widest leading-none">
                          Binance Live
                        </div>
                      ) : (
                        <div className="text-[8px] text-gray-500 bg-[#161b22] px-1 py-0.5 rounded w-max mt-0.5 uppercase tracking-widest leading-none">
                          Simulated
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-2">
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                          isLong ? 'bg-green-500/10 text-green-400' : 'bg-rose-500/10 text-rose-400'
                        }`}
                      >
                        {pos.side}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right text-gray-400 font-bold">{pos.size}</td>
                    <td className="py-2 px-2 text-right">${pos.entryPrice.toLocaleString()}</td>
                    <td className="py-2 px-2 text-right">${pos.currentPrice.toLocaleString()}</td>
                    <td className="py-2 px-2 text-right text-gray-400">
                      ${pos.margin.toFixed(2)} ({pos.leverage}X)
                    </td>
                    <td className="py-2 px-2 text-right text-[10px] text-gray-500">
                      SL: ${pos.stopLoss?.toLocaleString() || 'None'}
                      <br />
                      TP: ${pos.takeProfit?.toLocaleString() || 'None'}
                    </td>
                    <td className={`py-2 px-2 text-right font-bold ${getPnlColor(pos.unrealizedPnl)}`}>
                      ${pos.unrealizedPnl.toFixed(2)}
                      <br />
                      <span className="text-[10px] font-bold">({pos.pnlPercent.toFixed(2)}%)</span>
                    </td>
                    <td className="py-2 px-2 text-right">
                      <button
                        onClick={() => onClosePosition(pos.id)}
                        className="bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-rose-400 p-1 rounded transition-all inline-flex items-center justify-center cursor-pointer"
                        title="Close Position"
                      >
                        <X size={10} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
