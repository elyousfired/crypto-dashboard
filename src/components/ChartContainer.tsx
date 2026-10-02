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
import type { CandleData, ChartType, TokenConfig } from '../types/crypto';
import { calculateSMA, calculateBollingerBands } from '../utils/indicators';

interface ChartContainerProps {
  token: TokenConfig;
  data: CandleData[];
  chartType: ChartType;
  showMA: boolean;
  showBollinger: boolean;
  showVolume: boolean;
  latestCandle?: CandleData | null;
}

export const ChartContainer: React.FC<ChartContainerProps> = ({
  token,
  data,
  chartType,
  showMA,
  showBollinger,
  showVolume,
  latestCandle,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  
  // References to active series
  const mainSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ma7SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ma25SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ma99SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbUpperRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbMiddleRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbLowerRef = useRef<ISeriesApi<'Line'> | null>(null);

  // Tooltip state
  const [hoverData, setHoverData] = useState<{
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    change: number;
  } | null>(null);

  // Initialize and build the chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Clean up previous instance
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const container = chartContainerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight || 520,
      layout: {
        background: { type: ColorType.Solid, color: '#0b0e14' },
        textColor: '#94a3b8',
        fontSize: 12,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      },
      grid: {
        vertLines: { color: 'rgba(30, 41, 59, 0.4)' },
        horzLines: { color: 'rgba(30, 41, 59, 0.4)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: '#6366f1',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#4f46e5',
        },
        horzLine: {
          color: '#6366f1',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#4f46e5',
        },
      },
      rightPriceScale: {
        borderColor: '#1e293b',
        scaleMargins: {
          top: 0.1,
          bottom: showVolume ? 0.25 : 0.1,
        },
      },
      timeScale: {
        borderColor: '#1e293b',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // Create Main Series based on chartType
    if (chartType === 'candlestick') {
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderUpColor: '#22c55e',
        borderDownColor: '#ef4444',
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
      });
      mainSeriesRef.current = candleSeries;
    } else if (chartType === 'line') {
      const lineSeries = chart.addSeries(LineSeries, {
        color: '#06b6d4',
        lineWidth: 2,
      });
      mainSeriesRef.current = lineSeries;
    } else {
      const areaSeries = chart.addSeries(AreaSeries, {
        topColor: 'rgba(6, 182, 212, 0.4)',
        bottomColor: 'rgba(6, 182, 212, 0.01)',
        lineColor: '#06b6d4',
        lineWidth: 2,
      });
      mainSeriesRef.current = areaSeries;
    }

    // Volume Series
    if (showVolume) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: '#3b82f6',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: '', // overlay
      });
      volumeSeries.priceScale().applyOptions({
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
      });
      volumeSeriesRef.current = volumeSeries;
    }

    // Moving Averages Series
    if (showMA) {
      ma7SeriesRef.current = chart.addSeries(LineSeries, {
        color: '#eab308',
        lineWidth: 1,
        title: 'MA(7)',
      });
      ma25SeriesRef.current = chart.addSeries(LineSeries, {
        color: '#a855f7',
        lineWidth: 2,
        title: 'MA(25)',
      });
      ma99SeriesRef.current = chart.addSeries(LineSeries, {
        color: '#3b82f6',
        lineWidth: 2,
        title: 'MA(99)',
      });
    }

    // Bollinger Bands Series
    if (showBollinger) {
      bbUpperRef.current = chart.addSeries(LineSeries, {
        color: '#22d3ee',
        lineWidth: 1,
        title: 'BOLL Upper',
      });
      bbMiddleRef.current = chart.addSeries(LineSeries, {
        color: '#94a3b8',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        title: 'BOLL Mid',
      });
      bbLowerRef.current = chart.addSeries(LineSeries, {
        color: '#22d3ee',
        lineWidth: 1,
        title: 'BOLL Lower',
      });
    }

    // Subscribe to crosshair move for tooltip
    chart.subscribeCrosshairMove((param) => {
      if (
        param.time &&
        param.seriesData &&
        mainSeriesRef.current &&
        param.seriesData.has(mainSeriesRef.current)
      ) {
        const item: any = param.seriesData.get(mainSeriesRef.current);
        const candleItem = data.find((d) => d.time === param.time);

        if (item) {
          const open = item.open !== undefined ? item.open : item.value;
          const high = item.high !== undefined ? item.high : item.value;
          const low = item.low !== undefined ? item.low : item.value;
          const close = item.close !== undefined ? item.close : item.value;
          const vol = candleItem ? candleItem.volume : 0;
          const change = ((close - open) / open) * 100;

          const dateObj = new Date(Number(param.time) * 1000);
          setHoverData({
            time: dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            open,
            high,
            low,
            close,
            volume: vol,
            change,
          });
        }
      } else {
        setHoverData(null);
      }
    });

    const handleResize = () => {
      if (chartRef.current && container) {
        chartRef.current.applyOptions({
          width: container.clientWidth,
          height: container.clientHeight,
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
  }, [chartType, showMA, showBollinger, showVolume]);

  // Load and update data
  useEffect(() => {
    if (!chartRef.current || !mainSeriesRef.current || data.length === 0) return;

    const sortedData = [...data].sort((a, b) => a.time - b.time);
    const uniqueData: CandleData[] = [];
    const seenTimes = new Set<number>();
    for (const d of sortedData) {
      if (!seenTimes.has(d.time)) {
        seenTimes.add(d.time);
        uniqueData.push(d);
      }
    }

    if (uniqueData.length === 0) return;

    if (chartType === 'candlestick') {
      mainSeriesRef.current.setData(
        uniqueData.map((d) => ({
          time: d.time as UTCTimestamp,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
        }))
      );
    } else {
      mainSeriesRef.current.setData(
        uniqueData.map((d) => ({
          time: d.time as UTCTimestamp,
          value: d.close,
        }))
      );
    }

    if (showVolume && volumeSeriesRef.current) {
      volumeSeriesRef.current.setData(
        uniqueData.map((d) => ({
          time: d.time as UTCTimestamp,
          value: d.volume,
          color: d.close >= d.open ? 'rgba(34, 197, 94, 0.45)' : 'rgba(239, 68, 68, 0.45)',
        }))
      );
    }

    if (showMA) {
      if (ma7SeriesRef.current) {
        const ma7 = calculateSMA(uniqueData, 7);
        ma7SeriesRef.current.setData(ma7.map((m) => ({ time: m.time as UTCTimestamp, value: m.value })));
      }
      if (ma25SeriesRef.current) {
        const ma25 = calculateSMA(uniqueData, 25);
        ma25SeriesRef.current.setData(ma25.map((m) => ({ time: m.time as UTCTimestamp, value: m.value })));
      }
      if (ma99SeriesRef.current) {
        const ma99 = calculateSMA(uniqueData, 99);
        ma99SeriesRef.current.setData(ma99.map((m) => ({ time: m.time as UTCTimestamp, value: m.value })));
      }
    }

    if (showBollinger) {
      const bb = calculateBollingerBands(uniqueData, 20, 2);
      if (bbUpperRef.current) {
        bbUpperRef.current.setData(bb.upper.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
      }
      if (bbMiddleRef.current) {
        bbMiddleRef.current.setData(bb.middle.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
      }
      if (bbLowerRef.current) {
        bbLowerRef.current.setData(bb.lower.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
      }
    }

    chartRef.current.timeScale().fitContent();
  }, [data, chartType, showMA, showBollinger, showVolume]);

  // Real-time tick update
  useEffect(() => {
    if (!latestCandle || !mainSeriesRef.current) return;

    try {
      if (chartType === 'candlestick') {
        mainSeriesRef.current.update({
          time: latestCandle.time as UTCTimestamp,
          open: latestCandle.open,
          high: latestCandle.high,
          low: latestCandle.low,
          close: latestCandle.close,
        });
      } else {
        mainSeriesRef.current.update({
          time: latestCandle.time as UTCTimestamp,
          value: latestCandle.close,
        });
      }

      if (showVolume && volumeSeriesRef.current) {
        volumeSeriesRef.current.update({
          time: latestCandle.time as UTCTimestamp,
          value: latestCandle.volume,
          color: latestCandle.close >= latestCandle.open ? 'rgba(34, 197, 94, 0.45)' : 'rgba(239, 68, 68, 0.45)',
        });
      }
    } catch (err) {
      console.warn('Real-time candle update skipped:', err);
    }
  }, [latestCandle, chartType, showVolume]);

  return (
    <div className="relative w-full h-[540px] bg-[#0b0e14]">
      {/* Dynamic Hover Tooltip Bar */}
      <div className="absolute top-2 left-3 z-20 flex flex-wrap items-center gap-3 bg-[#0d121c]/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-mono shadow-lg pointer-events-none">
        <span className="font-bold text-white flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: token.color }} />
          {token.symbol}
        </span>

        {hoverData ? (
          <>
            <span className="text-slate-400">{hoverData.time}</span>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">O:</span>
              <span className="text-slate-200">${hoverData.open.toFixed(token.precision)}</span>
              <span className="text-slate-500">H:</span>
              <span className="text-emerald-400">${hoverData.high.toFixed(token.precision)}</span>
              <span className="text-slate-500">L:</span>
              <span className="text-rose-400">${hoverData.low.toFixed(token.precision)}</span>
              <span className="text-slate-500">C:</span>
              <span className="text-white font-semibold">${hoverData.close.toFixed(token.precision)}</span>
              <span className="text-slate-500">V:</span>
              <span className="text-cyan-400">{hoverData.volume.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
              <span
                className={`font-semibold ml-1 ${
                  hoverData.change >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {hoverData.change >= 0 ? '+' : ''}
                {hoverData.change.toFixed(2)}%
              </span>
            </div>
          </>
        ) : (
          <span className="text-slate-400">Hover over the chart to inspect candles</span>
        )}
      </div>

      {/* Legend Indicators */}
      <div className="absolute top-11 left-3 z-10 flex items-center gap-3 text-[11px] font-mono pointer-events-none">
        {showMA && (
          <div className="flex items-center gap-2 bg-[#0e131d]/70 px-2 py-0.5 rounded border border-slate-800/60">
            <span className="text-amber-400 font-medium">MA7</span>
            <span className="text-purple-400 font-medium">MA25</span>
            <span className="text-blue-400 font-medium">MA99</span>
          </div>
        )}
        {showBollinger && (
          <div className="flex items-center gap-1.5 bg-[#0e131d]/70 px-2 py-0.5 rounded border border-slate-800/60">
            <span className="text-cyan-400 font-medium">BOLL (20, 2)</span>
          </div>
        )}
      </div>

      {/* Lightweight Chart DOM container */}
      <div ref={chartContainerRef} className="w-full h-full" />
    </div>
  );
};
