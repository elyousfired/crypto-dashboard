import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  AreaSeries,
  HistogramSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
} from 'lightweight-charts';
import type {
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
} from 'lightweight-charts';
import type { CandleData, ChartType, Timeframe } from '../types/crypto';
import type { SyntheticPairConfig } from '../config/crossPairs';
import { calculateSMA, calculateBollingerBands } from '../utils/indicators';
import { TIMEFRAMES } from '../config/tokens';
import { getDynamicPrecision } from '../config/crossPairs';
import {
  BarChart2,
  TrendingUp,
  Activity,
  Maximize2,
} from 'lucide-react';

interface SyntheticPairChartProps {
  pair: SyntheticPairConfig;
  data: CandleData[];
  timeframe: Timeframe;
  setTimeframe: (tf: Timeframe) => void;
  chartType: ChartType;
  setChartType: (ct: ChartType) => void;
  showMA: boolean;
  setShowMA: (v: boolean) => void;
  showBollinger: boolean;
  setShowBollinger: (v: boolean) => void;
  showVolume: boolean;
  setShowVolume: (v: boolean) => void;
  onResetZoom?: () => void;
}

export const SyntheticPairChart: React.FC<SyntheticPairChartProps> = ({
  pair,
  data,
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
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const mainSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ma20SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ma50SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbUpperRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbMiddleRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbLowerRef = useRef<ISeriesApi<'Line'> | null>(null);

  // Tooltip hover state
  const [hoverData, setHoverData] = useState<{
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    change: number;
  } | null>(null);

  const latestCandle = data.length > 0 ? data[data.length - 1] : null;
  const precision = getDynamicPrecision(latestCandle ? latestCandle.close : 1);

  // Initialize and mount Lightweight Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const container = chartContainerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: 520,
      layout: {
        background: { type: ColorType.Solid, color: '#090d14' },
        textColor: '#94a3b8',
        fontSize: 12,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      },
      grid: {
        vertLines: { color: 'rgba(30, 41, 59, 0.3)' },
        horzLines: { color: 'rgba(30, 41, 59, 0.3)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: '#818cf8',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#6366f1',
        },
        horzLine: {
          color: '#818cf8',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#6366f1',
        },
      },
      rightPriceScale: {
        borderColor: '#1e293b',
        scaleMargins: {
          top: 0.1,
          bottom: showVolume ? 0.2 : 0.08,
        },
      },
      timeScale: {
        borderColor: '#1e293b',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // Custom price formatter based on precision
    const priceFormatConfig = {
      type: 'custom' as const,
      formatter: (price: number) => {
        if (price === 0) return '0.00';
        return price < 1
          ? price.toFixed(precision)
          : price.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: Math.max(precision, 4),
            });
      },
    };

    // Main Series (Candle, Line, Area)
    if (chartType === 'candlestick') {
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#10b981',
        downColor: '#ef4444',
        borderUpColor: '#10b981',
        borderDownColor: '#ef4444',
        wickUpColor: '#10b981',
        wickDownColor: '#ef4444',
        priceFormat: priceFormatConfig,
      });
      mainSeriesRef.current = candleSeries;
    } else if (chartType === 'line') {
      const lineSeries = chart.addSeries(LineSeries, {
        color: '#6366f1',
        lineWidth: 2,
        priceFormat: priceFormatConfig,
      });
      mainSeriesRef.current = lineSeries;
    } else {
      const areaSeries = chart.addSeries(AreaSeries, {
        topColor: 'rgba(99, 102, 241, 0.4)',
        bottomColor: 'rgba(99, 102, 241, 0.02)',
        lineColor: '#6366f1',
        lineWidth: 2,
        priceFormat: priceFormatConfig,
      });
      mainSeriesRef.current = areaSeries;
    }

    // Volume histogram
    if (showVolume) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: '#3b82f6',
        priceFormat: { type: 'volume' },
        priceScaleId: '',
      });
      volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.82, bottom: 0 },
      });
      volumeSeriesRef.current = volumeSeries;
    }

    // Moving Averages
    if (showMA) {
      ma20SeriesRef.current = chart.addSeries(LineSeries, {
        color: '#fbbf24',
        lineWidth: 1,
        title: 'MA20',
        priceScaleId: 'right',
      });
      ma50SeriesRef.current = chart.addSeries(LineSeries, {
        color: '#38bdf8',
        lineWidth: 1,
        title: 'MA50',
        priceScaleId: 'right',
      });
    }

    // Bollinger Bands
    if (showBollinger) {
      bbUpperRef.current = chart.addSeries(LineSeries, {
        color: 'rgba(168, 85, 247, 0.8)',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        title: 'BB Upper',
      });
      bbMiddleRef.current = chart.addSeries(LineSeries, {
        color: 'rgba(168, 85, 247, 0.5)',
        lineWidth: 1,
        title: 'BB Mid',
      });
      bbLowerRef.current = chart.addSeries(LineSeries, {
        color: 'rgba(168, 85, 247, 0.8)',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        title: 'BB Lower',
      });
    }

    // Crosshair move handler
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData || !mainSeriesRef.current) {
        setHoverData(null);
        return;
      }

      const point: any = param.seriesData.get(mainSeriesRef.current);
      if (!point) return;

      const date = new Date(Number(param.time) * 1000);
      const timeStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      let open = point.open ?? point.value ?? 0;
      let high = point.high ?? point.value ?? 0;
      let low = point.low ?? point.value ?? 0;
      let close = point.close ?? point.value ?? 0;

      let vol = 0;
      if (volumeSeriesRef.current && param.seriesData.has(volumeSeriesRef.current)) {
        const vPoint: any = param.seriesData.get(volumeSeriesRef.current);
        vol = vPoint?.value ?? 0;
      }

      const change = open > 0 ? ((close - open) / open) * 100 : 0;

      setHoverData({
        time: timeStr,
        open,
        high,
        low,
        close,
        volume: vol,
        change,
      });
    });

    const handleResize = () => {
      if (chartRef.current && container) {
        chartRef.current.applyOptions({
          width: container.clientWidth,
          height: container.clientHeight || 520,
        });
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [chartType, showVolume, showMA, showBollinger, precision]);

  // Push data into the chart
  useEffect(() => {
    if (!mainSeriesRef.current || !data.length) return;

    if (chartType === 'candlestick') {
      const formatted = data.map((d) => ({
        time: d.time as UTCTimestamp,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }));
      mainSeriesRef.current.setData(formatted);
    } else {
      const formatted = data.map((d) => ({
        time: d.time as UTCTimestamp,
        value: d.close,
      }));
      mainSeriesRef.current.setData(formatted);
    }

    if (showVolume && volumeSeriesRef.current) {
      const volData = data.map((d) => ({
        time: d.time as UTCTimestamp,
        value: d.volume,
        color: d.close >= d.open ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)',
      }));
      volumeSeriesRef.current.setData(volData);
    }

    if (showMA) {
      if (ma20SeriesRef.current) {
        const ma20 = calculateSMA(data, 20);
        ma20SeriesRef.current.setData(ma20.map((d) => ({ time: d.time as UTCTimestamp, value: d.value })));
      }
      if (ma50SeriesRef.current) {
        const ma50 = calculateSMA(data, 50);
        ma50SeriesRef.current.setData(ma50.map((d) => ({ time: d.time as UTCTimestamp, value: d.value })));
      }
    }

    if (showBollinger) {
      const bb = calculateBollingerBands(data, 20, 2);
      if (bbUpperRef.current) {
        bbUpperRef.current.setData(bb.upper.map((b) => ({ time: b.time as UTCTimestamp, value: b.value })));
      }
      if (bbMiddleRef.current) {
        bbMiddleRef.current.setData(bb.middle.map((b) => ({ time: b.time as UTCTimestamp, value: b.value })));
      }
      if (bbLowerRef.current) {
        bbLowerRef.current.setData(bb.lower.map((b) => ({ time: b.time as UTCTimestamp, value: b.value })));
      }
    }

    chartRef.current?.timeScale().fitContent();
  }, [data, chartType, showVolume, showMA, showBollinger]);

  const fitZoom = () => {
    chartRef.current?.timeScale().fitContent();
  };

  return (
    <div className="flex flex-col bg-[#0b0e14] rounded-2xl border border-slate-800/90 overflow-hidden shadow-xl">
      {/* Chart Top Controls Bar */}
      <div className="bg-[#0e131d] border-b border-slate-800/80 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Timeframe Switcher */}
        <div className="flex items-center gap-1.5 bg-[#090d14] p-1 rounded-xl border border-slate-800">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setTimeframe(tf.value)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition cursor-pointer ${
                timeframe === tf.value
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>

        {/* Center: Chart Type (Candlestick / Line / Area) */}
        <div className="flex items-center gap-1 bg-[#090d14] p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setChartType('candlestick')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
              chartType === 'candlestick'
                ? 'bg-slate-700 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Bougies</span>
          </button>
          <button
            onClick={() => setChartType('line')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
              chartType === 'line'
                ? 'bg-slate-700 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Ligne</span>
          </button>
          <button
            onClick={() => setChartType('area')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
              chartType === 'area'
                ? 'bg-slate-700 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Zone</span>
          </button>
        </div>

        {/* Right: Indicators & Zoom */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setShowMA(!showMA)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
              showMA
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                : 'bg-slate-800/80 text-slate-400 border-slate-700/60 hover:text-slate-200'
            }`}
          >
            MA 20/50
          </button>
          <button
            onClick={() => setShowBollinger(!showBollinger)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
              showBollinger
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-sm'
                : 'bg-slate-800/80 text-slate-400 border-slate-700/60 hover:text-slate-200'
            }`}
          >
            Bollinger
          </button>
          <button
            onClick={() => setShowVolume(!showVolume)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
              showVolume
                ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 shadow-sm'
                : 'bg-slate-800/80 text-slate-400 border-slate-700/60 hover:text-slate-200'
            }`}
          >
            Volume
          </button>
          <button
            onClick={fitZoom}
            className="p-1.5 rounded-lg bg-slate-800/80 text-slate-400 hover:text-white border border-slate-700/60 transition cursor-pointer"
            title="Ajuster la vue"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Floating Candle Info Bar (Live or Hover) */}
      <div className="bg-[#0b0e14]/90 px-4 py-2 border-b border-slate-800/60 flex items-center justify-between text-xs font-mono flex-wrap gap-2">
        {hoverData ? (
          <div className="flex items-center gap-3 text-slate-300 flex-wrap">
            <span className="text-slate-400">{hoverData.time}</span>
            <span>
              O: <strong className="text-white">{hoverData.open.toFixed(precision)}</strong>
            </span>
            <span>
              H: <strong className="text-emerald-400">{hoverData.high.toFixed(precision)}</strong>
            </span>
            <span>
              L: <strong className="text-rose-400">{hoverData.low.toFixed(precision)}</strong>
            </span>
            <span>
              C: <strong className="text-white">{hoverData.close.toFixed(precision)}</strong>
            </span>
            <span className={`font-bold ${hoverData.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {hoverData.change >= 0 ? '+' : ''}{hoverData.change.toFixed(2)}%
            </span>
          </div>
        ) : latestCandle ? (
          <div className="flex items-center gap-3 text-slate-300 flex-wrap">
            <span className="text-slate-500 text-[11px] uppercase font-sans font-bold">Dernière Bougie:</span>
            <span>
              O: <strong className="text-white">{latestCandle.open.toFixed(precision)}</strong>
            </span>
            <span>
              H: <strong className="text-emerald-400">{latestCandle.high.toFixed(precision)}</strong>
            </span>
            <span>
              L: <strong className="text-rose-400">{latestCandle.low.toFixed(precision)}</strong>
            </span>
            <span>
              C: <strong className="text-white">{latestCandle.close.toFixed(precision)}</strong>
            </span>
            <span className="text-slate-500 font-sans text-[11px]">
              (Unité: {pair.quoteToken.baseAsset} par {pair.baseToken.baseAsset})
            </span>
          </div>
        ) : (
          <span className="text-slate-500">Calcul du ratio en cours...</span>
        )}

        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Formule Synthétique: Price({pair.baseToken.baseAsset}) ÷ Price({pair.quoteToken.baseAsset})</span>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="relative min-h-[500px] flex-1 bg-[#090d14]">
        {data.length === 0 && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-[#090d14]/80">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-400 font-mono">
              Synchronisation des bougies de {pair.baseToken.baseAsset} & {pair.quoteToken.baseAsset}...
            </span>
          </div>
        )}
        <div ref={chartContainerRef} className="w-full h-[520px]" />
      </div>
    </div>
  );
};
