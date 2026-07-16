import { useState } from 'react';
import { MarketState, AccountState } from '../types';
import { Sparkles, Send, Bot, Loader2, RefreshCcw } from 'lucide-react';

interface AIAdvisorPanelProps {
  marketState: MarketState;
  accountState: AccountState;
}

export default function AIAdvisorPanel({ marketState, accountState }: AIAdvisorPanelProps) {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const presets = [
    'Confluence analysis of 4 scoring layers',
    'Evaluate risk safety of 10X Leverage & 1.5% stop loss',
    'How to target 10% daily profit safely?',
    'Draft custom quantitative backtest report',
  ];

  const handleAsk = async (text: string) => {
    if (!text.trim() || loading) return;
    setLoading(true);
    setResponse('');

    try {
      const res = await fetch('/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: text,
          marketState,
          strategySettings: {
            leverage: accountState.leverage,
            riskPercent: accountState.riskPercent,
            dailyLossLimit: accountState.dailyLossLimit,
            dailyDrawdownLimit: accountState.dailyDrawdownLimit,
          },
        }),
      });

      const data = await res.json();
      if (data.error) {
        setResponse(`### Error\n${data.error}`);
      } else {
        setResponse(data.text);
      }
    } catch (err: any) {
      setResponse(`### Network Error\nFailed to reach server-side Gemini Advisor. Please verify that server is running.\n\nError details: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="ai_advisor_panel" className="bg-[#0d1117] border border-[#1f242d] rounded p-4 shadow-xl flex flex-col h-full">
      <div className="flex justify-between items-center border-b border-[#1f242d] pb-3 mb-3">
        <div>
          <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
            <Bot size={14} className="text-[#f3ba2f]" />
            Quant-Core Gemini Co-Pilot
          </h3>
          <p className="text-[10px] text-gray-500 mt-0.5 font-mono">
            Gemini 3.1 Pro Intelligence • Real-Time Confluence Auditor
          </p>
        </div>
        <div className="flex items-center gap-1 bg-[#f3ba2f]/10 border border-[#f3ba2f]/25 px-2 py-0.5 rounded">
          <Sparkles size={10} className="text-[#f3ba2f]" />
          <span className="text-[9px] font-bold text-[#f3ba2f] font-mono tracking-wider">REASONING ACTIVE</span>
        </div>
      </div>

      {/* Preset Chips */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {presets.map((preset, idx) => (
          <button
            key={idx}
            onClick={() => {
              setQuery(preset);
              handleAsk(preset);
            }}
            disabled={loading}
            className="text-[10px] bg-[#161b22] border border-[#30363d] hover:border-[#f3ba2f]/40 text-gray-400 hover:text-white px-2.5 py-1 rounded transition-all text-left font-mono cursor-pointer"
          >
            {preset}
          </button>
        ))}
      </div>

      {/* Response Box */}
      <div className="flex-1 min-h-[160px] max-h-[300px] overflow-y-auto bg-[#0a0c10] border border-[#30363d] rounded p-3 font-mono text-xs text-gray-300 mb-3 flex flex-col">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-gray-500 py-6">
            <Loader2 className="animate-spin text-[#f3ba2f]" size={20} />
            <p className="text-[9px] font-bold animate-pulse uppercase tracking-wider text-center">
              Gemini is exploring deep quantitative scoring paths...
            </p>
          </div>
        ) : response ? (
          <div className="space-y-3 whitespace-pre-wrap leading-relaxed text-[11px]">
            {/* Split formatting for clear display */}
            {response.split('\n').map((line, i) => {
              if (line.startsWith('### ')) {
                return (
                  <h4 key={i} className="text-xs font-bold text-[#f3ba2f] border-b border-[#1f242d] pb-1 mt-3">
                    {line.replace('### ', '')}
                  </h4>
                );
              }
              if (line.startsWith('## ')) {
                return (
                  <h3 key={i} className="text-xs font-extrabold text-white border-b border-[#1f242d] pb-1 mt-3">
                    {line.replace('## ', '')}
                  </h3>
                );
              }
              if (line.startsWith('- ') || line.startsWith('* ')) {
                return (
                  <div key={i} className="flex items-start gap-1.5 pl-1 text-gray-300">
                    <span className="text-[#f3ba2f] mt-1">•</span>
                    <span>{line.substring(2)}</span>
                  </div>
                );
              }
              if (line.startsWith('**') && line.endsWith('**')) {
                return (
                  <p key={i} className="font-bold text-white">
                    {line.replaceAll('**', '')}
                  </p>
                );
              }
              return <p key={i} className="text-gray-400 leading-normal">{line}</p>;
            })}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-500 gap-1.5 py-6">
            <Bot size={24} className="text-[#f3ba2f]/60" />
            <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400">
              Dissecting SMC structures & risk parameters
            </p>
            <p className="text-[9px] max-w-[220px] leading-normal text-gray-600 mt-0.5">
              Select a preset or ask the Gemini auditor a custom strategy query.
            </p>
          </div>
        )}
      </div>

      {/* Input bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAsk(query);
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask about 4-layer scoring, 10% daily profit safety..."
          disabled={loading}
          className="flex-1 bg-[#0a0c10] border border-[#30363d] hover:border-gray-700 focus:border-[#f3ba2f]/50 rounded px-3 py-1.5 text-xs font-mono text-white placeholder-gray-600 focus:outline-none transition-all"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="bg-[#1f242d] hover:bg-[#30363d] border border-[#30363d] disabled:bg-gray-800 disabled:text-gray-600 text-[#f3ba2f] px-3 rounded transition-all cursor-pointer flex items-center justify-center"
        >
          <Send size={12} />
        </button>
      </form>
    </div>
  );
}
