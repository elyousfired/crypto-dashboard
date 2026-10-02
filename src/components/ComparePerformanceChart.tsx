import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  createChart,
  LineSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
} from 'lightweight-charts';
import type {
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
} from 'lightweight-charts';
import type { TokenConfig, CandleData } from '../types/crypto';
import { ArrowUpRight, ArrowDownRight, CheckSquare, Square, TrendingUp, Award, Layers } from 'lucide-react';

interface ComparePerformanceChartProps {
  tokens: TokenConfig[];
  multiCandles: Record<string, CandleData[]>;
  timeframe: string;
  onTimeframeChange: (tf: string) => void;
  onSelectToken: (token: TokenConfig) => void;
}

export const ComparePerformanceChart: React.FC<ComparePerformanceChartProps> = ({
  tokens,
  multiCandles,
  timeframe,
  onTimeframeChange,
  onSelectToken,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesMapRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());

  // State to toggle visibility of individual tokens
  const [enabledTokens, setEnabledTokens] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    tokens.forEach((t) => {
      initial[t.id] = true;
    });
    return initial;
  });

  // Crosshair hover state
  const [hoverTime, setHoverTime] = useState<string | null>(null);
  const [hoverValues, setHoverValues] = useState<Record<string, number>>({});

  const toggleToken = (tokenId: string) => {
    setEnabledTokens((prev) => ({
      ...prev,
      [tokenId]: !prev[tokenId],
    }));
  };

  const enableAll = () => {
    const updated: Record<string, boolean> = {};
    tokens.forEach((t) => {
      updated[t.id] = true;
    });
    setEnabledTokens(updated);
  };

  // Calculate normalized percentage performance data for each token
  // Formula: Return% = ((Close_t - Close_0) / Close_0) * 100
  const normalizedSeriesData = useMemo(() => {
    const result: Record<string, { time: UTCTimestamp; value: number }[]> = {};

    tokens.forEach((token) => {
      const rawCandles = multiCandles[token.symbol] || [];
      if (rawCandles.length < 2) {
        result[token.id] = [];
        return;
      }

      // Sort candles chronologically
      const sorted = [...rawCandles].sort((a, b) => a.time - b.time);
      const baseClose = sorted[0].close;

      if (!baseClose || baseClose <= 0) {
        result[token.id] = [];
        return;
      }

      // Unique timestamps
      const seenTimes = new Set<number>();
      const points: { time: UTCTimestamp; value: number }[] = [];

      sorted.forEach((c) => {
        if (!seenTimes.has(c.time)) {
          seenTimes.add(c.time);
          const pctChange = ((c.close - baseClose) / baseClose) * 100;
          points.push({
            time: c.time as UTCTimestamp,
            value: parseFloat(pctChange.toFixed(2)),
          });
        }
      });

      result[token.id] = points;
    });

    return result;
  }, [tokens, multiCandles]);

  // Current performance summary (latest % gain/loss)
  const performanceLeaderboard = useMemo(() => {
    return tokens
      .map((token) => {
        const series = normalizedSeriesData[token.id] || [];
        const latestVal = series.length > 0 ? series[series.length - 1].value : 0;
        return {
          token,
          returnPct: latestVal,
          enabled: enabledTokens[token.id] ?? true,
        };
      })
      .sort((a, b) => b.returnPct - a.returnPct);
  }, [tokens, normalizedSeriesData, enabledTokens]);

  // Initialize Lightweight Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      seriesMapRef.current.clear();
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
        vertLines: { color: 'rgba(30, 41, 59, 0.4)' },
        horzLines: { color: 'rgba(30, 41, 59, 0.4)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: '#6366f1',
          width: 1,
          style: LineStyle.Dashed,
        },
        horzLine: {
          color: '#6366f1',
          width: 1,
          style: LineStyle.Dashed,
        },
      },
      rightPriceScale: {
        borderColor: '#1e293b',
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      timeScale: {
        borderColor: '#1e293b',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // Create line series for each token
    tokens.forEach((token) => {
      const lineSeries = chart.addSeries(LineSeries, {
        color: token.color,
        lineWidth: 2,
        title: token.baseAsset,
        priceFormat: {
          type: 'custom',
          formatter: (price: number) => `${price >= 0 ? '+' : ''}${price.toFixed(2)}%`,
        },
      });

      // Add 0% baseline marker to the first active series
      seriesMapRef.current.set(token.id, lineSeries);
    });

    // Add dashed 0% baseline price line
    const firstSeries = seriesMapRef.current.values().next().value;
    if (firstSeries) {
      firstSeries.createPriceLine({
        price: 0,
        color: '#64748b',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: '0.00% Baseline',
      });
    }

    // Subscribe to crosshair move for multi-token tooltip
    chart.subscribeCrosshairMove((param) => {
      if (param.time && param.seriesData) {
        const dateObj = new Date(Number(param.time) * 1000);
        setHoverTime(dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

        const values: Record<string, number> = {};
        tokens.forEach((token) => {
          const s = seriesMapRef.current.get(token.id);
          if (s && param.seriesData.has(s)) {
            const dataPoint: any = param.seriesData.get(s);
            if (dataPoint && dataPoint.value !== undefined) {
              values[token.id] = dataPoint.value;
            }
          }
        });
        setHoverValues(values);
      } else {
        setHoverTime(null);
        setHoverValues({});
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
        seriesMapRef.current.clear();
      }
    };
  }, [tokens]);

  // Update data and visibility for each series
  useEffect(() => {
    if (!chartRef.current) return;

    tokens.forEach((token) => {
      const series = seriesMapRef.current.get(token.id);
      if (!series) return;

      const isEnabled = enabledTokens[token.id] ?? true;
      const data = normalizedSeriesData[token.id] || [];

      if (isEnabled && data.length > 0) {
        series.applyOptions({ visible: true });
        series.setData(data);
      } else {
        series.applyOptions({ visible: false });
        series.setData([]);
      }
    });

    chartRef.current.timeScale().fitContent();
  }, [tokens, normalizedSeriesData, enabledTokens]);

  return (
    <div className="flex flex-col bg-[#090d14] min-h-[640px] p-4 lg:p-6 space-y-5">
      {/* Title & Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0d121c] p-4 rounded-2xl border border-slate-800 shadow-md">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight m-0">
              Comparative Performance Chart (Gain / Loss %)
            </h2>
            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Normalized Baseline (0%)
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Compare relative performance across Binance (Sui, Solana, Zcash, Pengu) & Bybit (Monad, Hyperliquid, Hyperlane).
          </p>
        </div>

        {/* Timeframe & Action Buttons */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-[#090d14] p-1 rounded-xl border border-slate-800">
            {['15m', '1h', '4h', '1d'].map((tf) => (
              <button
                key={tf}
                onClick={() => onTimeframeChange(tf)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold font-mono transition cursor-pointer ${
                  timeframe === tf
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tf.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            onClick={enableAll}
            className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700/60 transition cursor-pointer flex items-center gap-1.5"
            title="Reset and show all tokens"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Select All</span>
          </button>
        </div>
      </div>

      {/* Main Chart Canvas with Dynamic Tooltip */}
      <div className="relative bg-[#0b0e14] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {/* Dynamic Multi-token Hover Tooltip */}
        <div className="absolute top-3 left-4 z-20 flex flex-wrap items-center gap-2.5 bg-[#0d121c]/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-800 text-xs font-mono shadow-xl pointer-events-none max-w-full">
          {hoverTime ? (
            <>
              <span className="text-slate-400 font-semibold">{hoverTime}</span>
              <div className="flex flex-wrap items-center gap-2">
                {tokens.map((token) => {
                  const val = hoverValues[token.id];
                  if (val === undefined || !enabledTokens[token.id]) return null;
                  const isPos = val >= 0;
                  return (
                    <div
                      key={token.id}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800/70 border border-slate-700/60"
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: token.color }} />
                      <span className="text-slate-200 font-semibold">{token.baseAsset}:</span>
                      <span className={isPos ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {isPos ? '+' : ''}{val.toFixed(2)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <span className="text-slate-400">
              Hover across the curves to compare Gain / Loss % at any point in time
            </span>
          )}
        </div>

        {/* Lightweight Chart Container */}
        <div ref={chartContainerRef} className="w-full h-[520px]" />
      </div>

      {/* Performance Leaderboard Cards & Token Filter Toggles */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white m-0">
              Return Leaderboard & Visibility Toggles
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Click any card to toggle on/off or view focus
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {performanceLeaderboard.map((item, index) => {
            const { token, returnPct, enabled } = item;
            const isPos = returnPct >= 0;

            return (
              <div
                key={token.id}
                className={`relative p-3 rounded-xl border transition-all cursor-pointer select-none flex flex-col justify-between ${
                  enabled
                    ? 'bg-slate-900/80 border-slate-700/80 shadow-md'
                    : 'bg-slate-950/40 border-slate-900 opacity-50'
                }`}
                onClick={() => toggleToken(token.id)}
              >
                {/* Top: Rank badge & Exchange */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                      #{index + 1}
                    </span>
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: token.color }} />
                    <span className="text-xs font-bold text-white">{token.baseAsset}</span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleToken(token.id);
                    }}
                    className="text-slate-400 hover:text-white"
                  >
                    {enabled ? (
                      <CheckSquare className="w-4 h-4 text-indigo-400" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-600" />
                    )}
                  </button>
                </div>

                {/* Return Percentage */}
                <div className="my-1">
                  <div
                    className={`text-lg font-black font-mono flex items-center gap-1 ${
                      isPos ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {isPos ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    <span>
                      {isPos ? '+' : ''}{returnPct.toFixed(2)}%
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {token.exchange.toUpperCase()} • {token.name}
                  </div>
                </div>

                {/* Quick focus link */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectToken(token);
                  }}
                  className="mt-2 text-[10px] text-center font-semibold py-1 rounded bg-slate-800/80 hover:bg-indigo-600 text-slate-300 hover:text-white transition"
                >
                  View Details →
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
