import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  createChart,
  LineSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
} from 'lightweight-charts';
import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import type { TokenConfig, CandleData } from '../types/crypto';
import { fetchBinanceKlines } from '../services/binanceService';
import { fetchBybitKlines } from '../services/bybitService';
import { fetchHyperliquidKlines } from '../services/hyperliquidService';
import { RefreshCw, TrendingUp } from 'lucide-react';

interface PortfolioCompareChartProps {
  tokens: TokenConfig[];
}

type TimeframeOption = '1h' | '4h' | '24h' | '7d' | '30d';

const TIMEFRAMES: { id: TimeframeOption; label: string; desc: string }[] = [
  { id: '1h', label: '1H', desc: 'Dernière heure' },
  { id: '4h', label: '4H', desc: 'Dernières 4h' },
  { id: '24h', label: '24H', desc: 'Dernières 24h' },
  { id: '7d', label: '7J', desc: 'Dernière semaine' },
  { id: '30d', label: '30J', desc: 'Dernier mois' },
];

const PALETTE = [
  '#69aac1', // signature cyan StonkFun
  '#39d6a3', // emerald
  '#f59e0b', // amber
  '#a855f7', // purple
  '#fb7185', // rose
  '#38bdf8', // sky
  '#fb923c', // orange
  '#c084fc', // violet
  '#4ade80', // green
  '#f43f5e', // red
];

export const PortfolioCompareChart: React.FC<PortfolioCompareChartProps> = ({ tokens }) => {
  const [selectedTf, setSelectedTf] = useState<TimeframeOption>('24h');
  const [candlesMap, setCandlesMap] = useState<Record<string, CandleData[]>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Toggle visibility of each token series
  const [enabledTokens, setEnabledTokens] = useState<Record<string, boolean>>({});

  // Hover crosshair state
  const [hoverTime, setHoverTime] = useState<string | null>(null);
  const [hoverValues, setHoverValues] = useState<Record<string, number>>({});

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesMapRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());

  // Assign distinct colors
  const tokenColors = useMemo(() => {
    const map: Record<string, string> = {};
    tokens.forEach((t, i) => {
      map[t.id] = t.color || PALETTE[i % PALETTE.length];
    });
    return map;
  }, [tokens]);

  // Fetch candle data for all tokens given current timeframe
  const loadKlines = useCallback(async (tf: TimeframeOption) => {
    if (tokens.length === 0) return;
    setIsLoading(true);

    try {
      const results: Record<string, CandleData[]> = {};

      await Promise.all(
        tokens.map(async (token) => {
          try {
            let candles: CandleData[] = [];

            if (token.exchange === 'binance' || (!token.exchange && token.symbol.endsWith('USDT'))) {
              const binanceInterval =
                tf === '1h' ? '1m' :
                tf === '4h' ? '5m' :
                tf === '24h' ? '15m' :
                tf === '7d' ? '1h' : '4h';
              const limit =
                tf === '1h' ? 60 :
                tf === '4h' ? 48 :
                tf === '24h' ? 96 :
                tf === '7d' ? 168 : 180;

              try {
                candles = await fetchBinanceKlines(token.symbol, binanceInterval, limit);
              } catch {
                candles = [];
              }

              // Fallback to Bybit if Binance returned empty
              if (!candles || candles.length === 0) {
                const bybitInterval =
                  tf === '1h' ? '1' :
                  tf === '4h' ? '5' :
                  tf === '24h' ? '15' :
                  tf === '7d' ? '60' : '240';
                candles = await fetchBybitKlines(token.symbol, bybitInterval, 'spot', limit);
              }
            } else if (token.exchange === 'bybit') {
              const bybitInterval =
                tf === '1h' ? '1' :
                tf === '4h' ? '5' :
                tf === '24h' ? '15' :
                tf === '7d' ? '60' : '240';
              const limit =
                tf === '1h' ? 60 :
                tf === '4h' ? 48 :
                tf === '24h' ? 96 :
                tf === '7d' ? 168 : 180;

              candles = await fetchBybitKlines(token.symbol, bybitInterval, token.bybitCategory || 'spot', limit);
            } else if (token.exchange === 'hyperliquid') {
              const hlInterval =
                tf === '1h' ? '1m' :
                tf === '4h' ? '5m' :
                tf === '24h' ? '15m' :
                tf === '7d' ? '1h' : '4h';
              const limit =
                tf === '1h' ? 60 :
                tf === '4h' ? 48 :
                tf === '24h' ? 96 :
                tf === '7d' ? 168 : 180;

              candles = await fetchHyperliquidKlines(token.hyperliquidCoin || token.baseAsset, hlInterval, limit);
            }

            if (candles && candles.length > 0) {
              results[token.id] = candles;
            }
          } catch (err) {
            console.warn(`Error fetching klines for ${token.symbol}:`, err);
          }
        })
      );

      setCandlesMap(results);
    } catch (e) {
      console.error('Failed to load comparison candles:', e);
    } finally {
      setIsLoading(false);
    }
  }, [tokens]);

  // Reload when tokens or timeframe changes
  useEffect(() => {
    loadKlines(selectedTf);
  }, [loadKlines, selectedTf]);

  // Calculate normalized performance % for each token: ((P_t - P_0) / P_0) * 100
  const normalizedSeriesData = useMemo(() => {
    const result: Record<string, { time: UTCTimestamp; value: number }[]> = {};

    tokens.forEach((token) => {
      const rawCandles = candlesMap[token.id] || [];
      if (rawCandles.length < 2) {
        result[token.id] = [];
        return;
      }

      const sorted = [...rawCandles].sort((a, b) => a.time - b.time);
      const baseClose = sorted[0].close;

      if (!baseClose || baseClose <= 0) {
        result[token.id] = [];
        return;
      }

      const seenTimes = new Set<number>();
      const points: { time: UTCTimestamp; value: number }[] = [];

      sorted.forEach((c) => {
        if (!seenTimes.has(c.time)) {
          seenTimes.add(c.time);
          const pct = ((c.close - baseClose) / baseClose) * 100;
          points.push({
            time: c.time as UTCTimestamp,
            value: parseFloat(pct.toFixed(2)),
          });
        }
      });

      result[token.id] = points;
    });

    return result;
  }, [tokens, candlesMap]);

  // Latest return % per token for ranking
  const latestReturns = useMemo(() => {
    const map: Record<string, number> = {};
    tokens.forEach((t) => {
      const series = normalizedSeriesData[t.id] || [];
      map[t.id] = series.length > 0 ? series[series.length - 1].value : 0;
    });
    return map;
  }, [tokens, normalizedSeriesData]);

  // Initialize and update Lightweight Charts
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
      height: 440,
      layout: {
        background: { type: ColorType.Solid, color: '#102127' }, // surface
        textColor: '#768a93', // ink-dim
        fontSize: 11,
        fontFamily: '"Geist Mono", "Sora", sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(32, 54, 61, 0.45)' }, // line
        horzLines: { color: 'rgba(32, 54, 61, 0.45)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: '#69aac1',
          width: 1,
          style: LineStyle.Dashed,
        },
        horzLine: {
          color: '#69aac1',
          width: 1,
          style: LineStyle.Dashed,
        },
      },
      rightPriceScale: {
        borderColor: '#20363d',
        scaleMargins: {
          top: 0.12,
          bottom: 0.12,
        },
      },
      timeScale: {
        borderColor: '#20363d',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // Create series for each token
    tokens.forEach((token) => {
      const isVisible = enabledTokens[token.id] !== false;
      const color = tokenColors[token.id];

      const lineSeries = chart.addSeries(LineSeries, {
        color: isVisible ? color : 'transparent',
        lineWidth: 2,
        title: token.baseAsset,
        priceFormat: {
          type: 'custom',
          formatter: (price: number) => `${price >= 0 ? '+' : ''}${price.toFixed(2)}%`,
        },
      });

      seriesMapRef.current.set(token.id, lineSeries);

      // Set data if enabled
      const data = normalizedSeriesData[token.id] || [];
      if (isVisible && data.length > 0) {
        lineSeries.setData(data);
      }
    });

    // Add 0.00% Baseline Line
    const firstSeries = seriesMapRef.current.values().next().value;
    if (firstSeries) {
      firstSeries.createPriceLine({
        price: 0,
        color: '#2f4f58', // line-strong
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: '0.00%',
      });
    }

    // Crosshair hover listener
    chart.subscribeCrosshairMove((param) => {
      if (param.time && param.seriesData) {
        const dateObj = new Date(Number(param.time) * 1000);
        setHoverTime(
          dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) +
            ' ' +
            dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        );

        const vals: Record<string, number> = {};
        tokens.forEach((token) => {
          const s = seriesMapRef.current.get(token.id);
          if (s && param.seriesData.has(s)) {
            const dataPoint: any = param.seriesData.get(s);
            if (dataPoint && dataPoint.value !== undefined) {
              vals[token.id] = dataPoint.value;
            }
          }
        });
        setHoverValues(vals);
      } else {
        setHoverTime(null);
        setHoverValues({});
      }
    });

    chart.timeScale().fitContent();

    // Resize handler
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [tokens, normalizedSeriesData, enabledTokens, tokenColors]);

  const toggleToken = (tokenId: string) => {
    setEnabledTokens((prev) => ({
      ...prev,
      [tokenId]: prev[tokenId] === false ? true : false,
    }));
  };

  const enableAll = () => {
    const all: Record<string, boolean> = {};
    tokens.forEach((t) => {
      all[t.id] = true;
    });
    setEnabledTokens(all);
  };

  return (
    <section className="rounded-xl border border-line bg-surface overflow-hidden">
      {/* Chart Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 border-b border-line">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-accent" />
              <span>Performance Comparative (% Gain / Perte)</span>
            </h3>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-well border border-line text-ink-dim">
              Base 0.00%
            </span>
          </div>
          <p className="text-xs text-ink-dim">
            Toutes les courbes de vos tokens superposées sur le même graphique pour comparer leurs rebonds et dips.
          </p>
        </div>

        {/* Timeframe Switcher (1H, 4H, 24H, 7J, 30J) */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-1 rounded-lg border border-line-strong bg-well p-1">
            {TIMEFRAMES.map((tf) => {
              const active = selectedTf === tf.id;
              return (
                <button
                  key={tf.id}
                  onClick={() => setSelectedTf(tf.id)}
                  title={tf.desc}
                  className={`h-8 px-3 rounded-md text-xs font-semibold font-mono transition-colors cursor-pointer ${
                    active
                      ? 'bg-line-strong text-ink'
                      : 'text-ink-dim hover:text-ink hover:bg-surface'
                  }`}
                >
                  {tf.label}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => loadKlines(selectedTf)}
            disabled={isLoading}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line-strong bg-well text-ink-dim hover:text-ink transition cursor-pointer"
            title="Rafraîchir les bougies"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-accent' : ''}`} />
          </button>
        </div>
      </div>

      {/* Interactive Legend & Token Filters */}
      <div className="px-5 py-3 border-b border-line bg-well/60 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {tokens.map((token) => {
            const isEnabled = enabledTokens[token.id] !== false;
            const color = tokenColors[token.id];
            const currentPct = hoverTime ? hoverValues[token.id] : latestReturns[token.id];
            const isPositive = (currentPct ?? 0) >= 0;

            return (
              <button
                key={token.id}
                onClick={() => toggleToken(token.id)}
                className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs font-mono transition cursor-pointer select-none ${
                  isEnabled
                    ? 'border-line-strong bg-surface hover:border-accent/40'
                    : 'border-transparent opacity-40 hover:opacity-70 bg-transparent'
                }`}
                title={`Cliquer pour masquer/afficher ${token.baseAsset}`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className={`font-semibold ${isEnabled ? 'text-ink' : 'text-ink-faint'}`}>
                  {token.baseAsset}
                </span>
                {currentPct !== undefined && isEnabled && (
                  <span className={`font-semibold ${isPositive ? 'text-up' : 'text-down'}`}>
                    {isPositive ? '+' : ''}
                    {currentPct.toFixed(2)}%
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {Object.values(enabledTokens).some((v) => v === false) && (
          <button
            onClick={enableAll}
            className="text-[11px] text-accent hover:text-accent-bright font-medium cursor-pointer"
          >
            Afficher tout
          </button>
        )}

        {hoverTime && (
          <span className="text-[11px] font-mono text-ink-dim ml-auto">
            {hoverTime}
          </span>
        )}
      </div>

      {/* Canvas Container */}
      <div className="relative p-2 bg-[#102127]">
        {isLoading && (
          <div className="absolute inset-0 z-10 bg-surface/70 backdrop-blur-[1px] flex items-center justify-center">
            <div className="flex items-center gap-2 text-xs font-mono text-ink-mid">
              <RefreshCw className="h-4 w-4 animate-spin text-accent" />
              <span>Chargement des courbes {selectedTf.toUpperCase()}...</span>
            </div>
          </div>
        )}
        <div ref={chartContainerRef} className="w-full h-[440px]" />
      </div>
    </section>
  );
};
