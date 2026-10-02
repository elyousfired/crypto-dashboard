import React from 'react';
import type { Timeframe, ChartType } from '../types/crypto';
import { TIMEFRAMES } from '../config/tokens';
import {
  CandlestickChart,
  TrendingUp,
  AreaChart,
  Sliders,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';

interface ChartControlsProps {
  timeframe: Timeframe;
  setTimeframe: (tf: Timeframe) => void;
  chartType: ChartType;
  setChartType: (type: ChartType) => void;
  showMA: boolean;
  setShowMA: (show: boolean) => void;
  showBollinger: boolean;
  setShowBollinger: (show: boolean) => void;
  showVolume: boolean;
  setShowVolume: (show: boolean) => void;
  showOrderBook: boolean;
  setShowOrderBook: (show: boolean) => void;
}

export const ChartControls: React.FC<ChartControlsProps> = ({
  timeframe,
  setTimeframe,
  chartType,
  setChartType,
  showMA,
  setShowMA,
  showBollinger,
  setShowBollinger,
  showVolume,
  setShowVolume,
  showOrderBook,
  setShowOrderBook,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900/90 border-b border-slate-800">
      {/* Timeframes */}
      <div className="flex items-center gap-1 bg-[#0b0e14] p-1 rounded-xl border border-slate-800">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf.value}
            onClick={() => setTimeframe(tf.value)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold font-mono transition cursor-pointer ${
              timeframe === tf.value
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            {tf.label}
          </button>
        ))}
      </div>

      {/* Chart Style, Indicators, and Order Book Toggle */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Chart Type Selector */}
        <div className="flex items-center bg-[#0b0e14] p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setChartType('candlestick')}
            className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
              chartType === 'candlestick'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Candlestick Chart"
          >
            <CandlestickChart className="w-4 h-4" />
          </button>
          <button
            onClick={() => setChartType('line')}
            className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
              chartType === 'line'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Line Chart"
          >
            <TrendingUp className="w-4 h-4" />
          </button>
          <button
            onClick={() => setChartType('area')}
            className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
              chartType === 'area'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Area Mountain Chart"
          >
            <AreaChart className="w-4 h-4" />
          </button>
        </div>

        {/* Indicators Toggles */}
        <div className="flex items-center gap-1 bg-[#0b0e14] p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setShowMA(!showMA)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              showMA
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Moving Averages (MA 7, 25, 99)"
          >
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>MA (7/25/99)</span>
          </button>

          <button
            onClick={() => setShowBollinger(!showBollinger)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              showBollinger
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Bollinger Bands (20, 2)"
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>BOLL</span>
          </button>

          <button
            onClick={() => setShowVolume(!showVolume)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              showVolume
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Volume Sub-chart"
          >
            <Sliders className="w-3 h-3" />
            <span>VOL</span>
          </button>
        </div>

        {/* Order Book Show/Hide Button */}
        <button
          onClick={() => setShowOrderBook(!showOrderBook)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border ${
            showOrderBook
              ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/50 shadow-sm'
              : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border-slate-700/60'
          }`}
          title={showOrderBook ? 'Masquer le carnet d\'ordres (Order Book)' : 'Afficher le carnet d\'ordres (Order Book)'}
        >
          {showOrderBook ? (
            <>
              <PanelRightClose className="w-3.5 h-3.5 text-indigo-400" />
              <span>Order Book: ON</span>
            </>
          ) : (
            <>
              <PanelRightOpen className="w-3.5 h-3.5 text-slate-400" />
              <span>Order Book: OFF</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
