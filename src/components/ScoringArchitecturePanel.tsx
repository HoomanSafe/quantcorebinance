import { ScoringDetails } from '../types';
import { ShieldCheck, Crosshair, BarChart3, Cpu, ArrowUpRight } from 'lucide-react';

interface ScoringArchitecturePanelProps {
  scoring: ScoringDetails;
}

export default function ScoringArchitecturePanel({ scoring }: ScoringArchitecturePanelProps) {
  const getSignalBadgeColor = (signal: string) => {
    switch (signal) {
      case 'STRONG_BUY':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'BUY':
        return 'bg-teal-500/10 text-teal-400 border-teal-500/30';
      case 'SELL':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'STRONG_SELL':
        return 'bg-red-500/10 text-red-400 border-red-500/30';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-teal-400';
    if (score >= 40) return 'text-amber-400';
    return 'text-rose-400';
  };

  return (
    <div id="scoring_panel" className="bg-[#0d1117] border border-[#1f242d] rounded p-4 shadow-xl">
      <div className="flex justify-between items-center border-b border-[#1f242d] pb-3 mb-4">
        <div>
          <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
            <Cpu size={14} className="text-[#f3ba2f]" />
            Scoring Architecture
          </h3>
          <p className="text-[10px] text-gray-500 font-mono tracking-widest">REAL-TIME INSTITUTIONAL LOGIC MATRIX</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[9px] text-gray-500 uppercase tracking-widest font-mono">Signal</div>
            <div className={`px-2 py-0.5 rounded border text-[10px] font-bold font-mono uppercase ${getSignalBadgeColor(scoring.signal)}`}>
              {scoring.signal.replace('_', ' ')}
            </div>
          </div>
          <div className="h-8 w-px bg-[#1f242d]" />
          <div className="text-right">
            <div className="text-[34px] font-bold font-mono leading-none text-[#f3ba2f]">
              {scoring.aggregateScore}
            </div>
            <div className="text-[9px] text-gray-500 uppercase tracking-widest font-mono">Composite</div>
          </div>
        </div>
      </div>

      {/* 4 Layers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* Layer 1 */}
        <div className="bg-[#161b22] border border-[#30363d] p-3.5 rounded relative overflow-hidden flex flex-col justify-between hover:border-gray-700 transition-all">
          <span className="absolute top-2 right-2.5 text-[10px] font-mono text-[#30363d] font-bold">L1</span>
          <div>
            <h4 className="text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-2 flex items-center gap-1">
              <ArrowUpRight size={12} className="text-green-500" />
              {scoring.layer1.name}
            </h4>
            <div className="text-[10px] text-gray-400 mb-2 leading-relaxed">
              Regime: <span className="text-white font-medium">{scoring.layer1.trend}</span> | {scoring.layer1.smcStructure}
              <p className="text-[10px] text-gray-500 italic mt-1">{scoring.layer1.reasoning}</p>
            </div>
          </div>
          <div className="mt-2.5">
            <div className="flex justify-between text-[9px] font-mono text-gray-500 mb-1">
              <span>CONFIDENCE</span>
              <span className={getScoreColor(scoring.layer1.score)}>{scoring.layer1.score}%</span>
            </div>
            <div className="w-full bg-[#0a0c10] h-1 rounded-full">
              <div className="bg-green-500 h-1 rounded-full transition-all duration-500" style={{ width: `${scoring.layer1.score}%` }}></div>
            </div>
          </div>
        </div>

        {/* Layer 2 */}
        <div className="bg-[#161b22] border border-[#30363d] p-3.5 rounded relative overflow-hidden flex flex-col justify-between hover:border-gray-700 transition-all">
          <span className="absolute top-2 right-2.5 text-[10px] font-mono text-[#30363d] font-bold">L2</span>
          <div>
            <h4 className="text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Crosshair size={12} className="text-blue-400" />
              {scoring.layer2.name}
            </h4>
            <div className="text-[10px] text-gray-400 mb-2 leading-relaxed">
              Proximity: <span className="text-blue-400 font-mono font-bold">{scoring.layer2.obProximity}</span> | {scoring.layer2.fvgProximity}
              <p className="text-[10px] text-gray-500 italic mt-1">{scoring.layer2.reasoning}</p>
            </div>
          </div>
          <div className="mt-2.5">
            <div className="flex justify-between text-[9px] font-mono text-gray-500 mb-1">
              <span>CONFLUENCE</span>
              <span className={getScoreColor(scoring.layer2.score)}>{scoring.layer2.score}%</span>
            </div>
            <div className="w-full bg-[#0a0c10] h-1 rounded-full">
              <div className="bg-blue-400 h-1 rounded-full transition-all duration-500" style={{ width: `${scoring.layer2.score}%` }}></div>
            </div>
          </div>
        </div>

        {/* Layer 3 */}
        <div className="bg-[#161b22] border border-[#30363d] p-3.5 rounded relative overflow-hidden flex flex-col justify-between hover:border-gray-700 transition-all">
          <span className="absolute top-2 right-2.5 text-[10px] font-mono text-[#30363d] font-bold">L3</span>
          <div>
            <h4 className="text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-2 flex items-center gap-1">
              <BarChart3 size={12} className="text-green-400" />
              {scoring.layer3.name}
            </h4>
            <div className="text-[10px] text-gray-400 mb-2 leading-relaxed">
              Taker Ratio: <span className="text-green-400 font-mono font-bold">{scoring.layer3.takerRatio}x</span> | {scoring.layer3.volumeDelta}
              <p className="text-[10px] text-gray-500 italic mt-1">{scoring.layer3.reasoning}</p>
            </div>
          </div>
          <div className="mt-2.5">
            <div className="flex justify-between text-[9px] font-mono text-gray-500 mb-1">
              <span>VOLUME DELTA</span>
              <span className={getScoreColor(scoring.layer3.score)}>{scoring.layer3.score}%</span>
            </div>
            <div className="w-full bg-[#0a0c10] h-1 rounded-full">
              <div className="bg-green-500 h-1 rounded-full transition-all duration-500" style={{ width: `${scoring.layer3.score}%` }}></div>
            </div>
          </div>
        </div>

        {/* Layer 4 */}
        <div className="bg-[#161b22] border border-[#30363d] p-3.5 rounded relative overflow-hidden flex flex-col justify-between hover:border-gray-700 transition-all">
          <span className="absolute top-2 right-2.5 text-[10px] font-mono text-[#30363d] font-bold">L4</span>
          <div>
            <h4 className="text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-2 flex items-center gap-1">
              <ShieldCheck size={12} className="text-amber-400" />
              {scoring.layer4.name}
            </h4>
            <div className="text-[10px] text-gray-400 mb-2 leading-relaxed">
              Buffers: <span className="text-amber-400">{scoring.layer4.riskBuffersCleared ? 'CLEARED' : 'PENDING'}</span> | Bounds: {scoring.layer4.dailyLossBoundsActive ? 'ACTIVE' : 'INACTIVE'}
              <p className="text-[10px] text-gray-500 italic mt-1">{scoring.layer4.reasoning}</p>
            </div>
          </div>
          <div className="mt-2.5">
            <div className="flex justify-between text-[9px] font-mono text-gray-500 mb-1">
              <span>SAFETY INDEX</span>
              <span className={getScoreColor(scoring.layer4.score)}>{scoring.layer4.score}%</span>
            </div>
            <div className="w-full bg-[#0a0c10] h-1 rounded-full">
              <div className="bg-amber-400 h-1 rounded-full transition-all duration-500" style={{ width: `${scoring.layer4.score}%` }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
