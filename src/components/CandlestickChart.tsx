import { useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
  Cell,
  ReferenceArea,
  CartesianGrid,
} from 'recharts';
import { Candle, OrderBlock, FairValueGap } from '../types';
import { Layers, Eye, ShieldAlert, TrendingUp } from 'lucide-react';

const RefArea = ReferenceArea as any;

interface CandlestickChartProps {
  candles: Candle[];
  orderBlocks: OrderBlock[];
  fairValueGaps: FairValueGap[];
  currentPrice: number;
}

export default function CandlestickChart({
  candles,
  orderBlocks,
  fairValueGaps,
  currentPrice,
}: CandlestickChartProps) {
  const [showOBs, setShowOBs] = useState(true);
  const [showFVGs, setShowFVGs] = useState(true);

  // Format data for Recharts floating bars
  // Recharts Bar can take a 2-element array [bottom, top] to render a floating bar
  const chartData = candles.map((candle) => {
    const isBullish = candle.close >= candle.open;
    return {
      time: candle.time,
      open: candle.open,
      close: candle.close,
      high: candle.high,
      low: candle.low,
      isBullish,
      // Body floating range: [min(open, close), max(open, close)]
      bodyRange: [Math.min(candle.open, candle.close), Math.max(candle.open, candle.close)],
      // Wick floating range: [low, high]
      wickRange: [candle.low, candle.high],
    };
  });

  // Calculate Y-axis domain with padding
  const allPrices = candles.flatMap((c) => [c.low, c.high]);
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const padding = (maxPrice - minPrice) * 0.15;
  const yDomain = [
    parseFloat((minPrice - padding).toFixed(2)),
    parseFloat((maxPrice + padding).toFixed(2)),
  ];

  return (
    <div id="chart_container" className="bg-[#0d1117] border border-[#1f242d] rounded p-4 shadow-xl relative">
      {/* Chart Headers */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-green-400 animate-pulse" />
            <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider font-mono">
              Binance USDⓈ-M Live Feed
            </h3>
          </div>
          <p className="text-[10px] text-gray-500 mt-0.5 font-mono">
            Smart Money Concepts (SMC) Automated Liquidity Mapping
          </p>
        </div>

        {/* Toggle Filters */}
        <div className="flex flex-wrap gap-1.5 text-[10px]">
          <button
            onClick={() => setShowOBs(!showOBs)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all font-mono uppercase font-bold cursor-pointer ${
              showOBs
                ? 'bg-[#161b22] border border-[#f3ba2f]/40 text-[#f3ba2f]'
                : 'bg-transparent border border-[#30363d] text-gray-500 hover:text-gray-300'
            }`}
          >
            <Layers size={10} />
            <span>Order Blocks (OB)</span>
          </button>
          <button
            onClick={() => setShowFVGs(!showFVGs)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all font-mono uppercase font-bold cursor-pointer ${
              showFVGs
                ? 'bg-[#161b22] border border-[#f3ba2f]/40 text-[#f3ba2f]'
                : 'bg-transparent border border-[#30363d] text-gray-500 hover:text-gray-300'
            }`}
          >
            <TrendingUp size={10} />
            <span>Fair Value Gaps (FVG)</span>
          </button>
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div className="h-[280px] w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid stroke="#1f242d" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="time"
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#8892b0', fontSize: 9, fontFamily: 'monospace' }}
            />
            <YAxis
              domain={yDomain}
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#8892b0', fontSize: 9, fontFamily: 'monospace' }}
              orientation="right"
              allowDecimals={true}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-[#0d1117] border border-[#30363d] rounded p-2.5 shadow-xl text-[10px] font-mono">
                      <p className="text-gray-400 border-b border-[#1f242d] pb-1 mb-1">{data.time}</p>
                      <p className="text-gray-300">
                        O: <span className="text-white">${data.open.toLocaleString()}</span>
                      </p>
                      <p className="text-gray-300">
                        H: <span className="text-white">${data.high.toLocaleString()}</span>
                      </p>
                      <p className="text-gray-300">
                        L: <span className="text-white">${data.low.toLocaleString()}</span>
                      </p>
                      <p className="text-gray-300">
                        C: <span className="text-white">${data.close.toLocaleString()}</span>
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />

            {/* Render FVGs as Reference Areas if turned on */}
            {showFVGs &&
              fairValueGaps.map((fvg) => (
                <RefArea
                  key={fvg.id}
                  y1={fvg.low}
                  y2={fvg.high}
                  fill={fvg.type === 'bullish' ? '#d97706' : '#ea580c'}
                  fillOpacity={0.05}
                  stroke={fvg.type === 'bullish' ? '#d97706' : '#ea580c'}
                  strokeDasharray="4 4"
                  strokeOpacity={0.2}
                />
              ))}

            {/* Render Order Blocks as Reference Areas if turned on */}
            {showOBs &&
              orderBlocks.map((ob) => (
                <RefArea
                  key={ob.id}
                  y1={ob.priceStart}
                  y2={ob.priceEnd}
                  fill={ob.type === 'bullish' ? '#10b981' : '#ef4444'}
                  fillOpacity={0.08}
                  stroke={ob.type === 'bullish' ? '#10b981' : '#ef4444'}
                  strokeDasharray="2 2"
                  strokeOpacity={0.3}
                />
              ))}

            {/* Render Candlestick Wick (Low to High line) */}
            <Bar dataKey="wickRange" fill="#4a5568" barSize={1} isAnimationActive={false}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-wick-${index}`}
                  fill={entry.isBullish ? '#2ea043' : '#f85149'}
                  fillOpacity={0.4}
                />
              ))}
            </Bar>

            {/* Render Candlestick Body (Open to Close bar) */}
            <Bar dataKey="bodyRange" fill="#4a5568" barSize={6} isAnimationActive={false}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-body-${index}`}
                  fill={entry.isBullish ? '#2ea043' : '#f85149'}
                />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>

        {/* Floating overlays for OB / FVG labels on chart */}
        <div className="absolute top-2 left-2 pointer-events-none flex flex-col gap-1 text-[9px] font-mono">
          {showOBs &&
            orderBlocks.map((ob) => (
              <div
                key={`lbl-${ob.id}`}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${
                  ob.type === 'bullish' ? 'bg-green-500/10 text-green-400' : 'bg-rose-500/10 text-rose-400'
                }`}
              >
                <div className={`h-1 w-1 rounded-full ${ob.type === 'bullish' ? 'bg-green-400' : 'bg-rose-400'}`} />
                <span>
                  {ob.type === 'bullish' ? 'DEMAND OB' : 'SUPPLY OB'}: ${ob.priceEnd} - ${ob.priceStart}
                </span>
              </div>
            ))}
        </div>

        {/* Current price marker */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 bg-[#0d1117]/90 backdrop-blur border-l-2 border-green-500 px-2 py-0.5 pointer-events-none text-right z-10 font-mono">
          <div className="text-[9px] text-gray-500 uppercase tracking-widest font-mono">Current</div>
          <div className="text-[11px] font-bold text-green-400 font-mono">
            ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* SMC Legends */}
      <div className="flex flex-wrap justify-between border-t border-[#1f242d] mt-3 pt-2 text-[10px] font-mono text-gray-400 gap-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500/20 border border-green-500/50" />
            <span>Demand OB (Discount Support)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500/20 border border-rose-500/50" />
            <span>Supply OB (Premium Resistance)</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <Eye size={11} className="text-green-400" />
            <span>Structure: Bullish BOS confirmed</span>
          </div>
          <div className="flex items-center gap-1 text-amber-400">
            <ShieldAlert size={11} />
            <span>FVG Imbalance Zone Active</span>
          </div>
        </div>
      </div>
    </div>
  );
}
