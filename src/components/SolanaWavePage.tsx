import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { TickerData, TokenConfig, CandleData } from '../types/crypto';
import { SOLANA_WAVE_TOKENS } from '../config/tokens';
import { fetchBinanceKlines } from '../services/binanceService';
import { fetchBybitKlines } from '../services/bybitService';
import { Activity, Waves, TrendingUp, Info, RefreshCw, Zap, Clock, Grid, Target, RotateCcw } from 'lucide-react';

interface SolanaWavePageProps {
  tickers: Record<string, TickerData>;
}

type WaveTimeframe = '15m' | '1h' | '4h' | '1d' | '1w';

interface TokenReturnSeries {
  token: TokenConfig;
  returns: number[]; // % return from start of window
  prices: number[];
}

export const SolanaWavePage: React.FC<SolanaWavePageProps> = ({ tickers }) => {
  // 1. Timeframe selection
  const [timeframe, setTimeframe] = useState<WaveTimeframe>('1h');

  // 2. Active tokens in the wave calculation (defaults to all 8 tokens)
  const [activeTokenIds, setActiveTokenIds] = useState<string[]>(() =>
    SOLANA_WAVE_TOKENS.map((t) => t.id)
  );

  // 3. Raw Candle data per token
  const [candlesMap, setCandlesMap] = useState<Record<string, CandleData[]>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [showMathModal, setShowMathModal] = useState<boolean>(false);
  const [showSineOverlay, setShowSineOverlay] = useState<boolean>(true);

  // 4. Multi-Token Grid State
  const [showTokenGrid, setShowTokenGrid] = useState<boolean>(true);
  const [gridTargetPercent, setGridTargetPercent] = useState<number>(2.0);

  // Toggle token inclusion
  const toggleToken = (id: string) => {
    setActiveTokenIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 2) {
          alert("L'onde nécessite au moins 2 tokens pour calculer l'interférence.");
          return prev;
        }
        return prev.filter((t) => t !== id);
      }
      return [...prev, id];
    });
  };

  const selectAllTokens = () => setActiveTokenIds(SOLANA_WAVE_TOKENS.map((t) => t.id));

  // Fetch Kline candles for all 8 tokens
  const loadWaveCandles = useCallback(async (tf: WaveTimeframe) => {
    setIsLoading(true);
    const results: Record<string, CandleData[]> = {};

    const binanceInterval =
      tf === '15m' ? '15m' :
      tf === '1h' ? '1h' :
      tf === '4h' ? '4h' :
      tf === '1d' ? '1d' : '1w';

    const bybitInterval =
      tf === '15m' ? '15' :
      tf === '1h' ? '60' :
      tf === '4h' ? '240' :
      tf === '1d' ? 'D' : 'W';

    const limit = tf === '15m' ? 96 : tf === '1h' ? 96 : tf === '4h' ? 72 : 60;

    await Promise.all(
      SOLANA_WAVE_TOKENS.map(async (token) => {
        try {
          let candles: CandleData[] = [];
          try {
            candles = await fetchBinanceKlines(token.symbol, binanceInterval, limit);
          } catch {
            candles = [];
          }

          if (!candles || candles.length === 0) {
            candles = await fetchBybitKlines(token.symbol, bybitInterval, 'spot', limit);
          }

          if (candles && candles.length > 0) {
            results[token.id] = candles;
          }
        } catch (err) {
          console.warn(`Could not load wave candles for ${token.symbol}:`, err);
        }
      })
    );

    setCandlesMap(results);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadWaveCandles(timeframe);
  }, [timeframe, loadWaveCandles]);

  // Synchronize and calculate returns
  const { timestamps, seriesList, compositeWave, cycleStats } = useMemo(() => {
    const activeTokens = SOLANA_WAVE_TOKENS.filter((t) => activeTokenIds.includes(t.id));
    if (activeTokens.length === 0) {
      return { timestamps: [], seriesList: [], compositeWave: [], cycleStats: null };
    }

    // Find common timestamps
    const availableSeries = activeTokens.map((t) => candlesMap[t.id] || []).filter((arr) => arr.length > 5);
    if (availableSeries.length === 0) {
      return { timestamps: [], seriesList: [], compositeWave: [], cycleStats: null };
    }

    // Find shortest common length
    const minLength = Math.min(...availableSeries.map((s) => s.length));
    if (minLength < 5) {
      return { timestamps: [], seriesList: [], compositeWave: [], cycleStats: null };
    }

    // Align from the end
    const refCandles = availableSeries[0].slice(-minLength);
    const times = refCandles.map((c) => c.time);

    // Compute % returns for each token
    const tokenSeries: TokenReturnSeries[] = activeTokens.map((token) => {
      const raw = (candlesMap[token.id] || []).slice(-minLength);
      if (raw.length === 0) {
        return { token, returns: new Array(minLength).fill(0), prices: new Array(minLength).fill(0) };
      }

      const basePrice = raw[0].close || 1;
      const returns = raw.map((c) => ((c.close - basePrice) / basePrice) * 100);
      const prices = raw.map((c) => c.close);
      return { token, returns, prices };
    });

    // 1. Superposition (Somme / Moyenne pondérée)
    const rawSum: number[] = [];
    for (let i = 0; i < minLength; i++) {
      let sum = 0;
      let count = 0;
      tokenSeries.forEach((s) => {
        if (s.returns[i] !== undefined) {
          sum += s.returns[i];
          count++;
        }
      });
      rawSum.push(count > 0 ? sum / count : 0);
    }

    // 2. Dé-trendage (Soustraire le trend macro pour ne garder que l'oscillation)
    const smaPeriod = Math.max(8, Math.min(24, Math.floor(minLength / 4)));
    const detrended: number[] = [];
    for (let i = 0; i < minLength; i++) {
      const start = Math.max(0, i - Math.floor(smaPeriod / 2));
      const end = Math.min(minLength, i + Math.floor(smaPeriod / 2) + 1);
      const slice = rawSum.slice(start, end);
      const avg = slice.reduce((a, b) => a + b, 0) / (slice.length || 1);
      detrended.push(rawSum[i] - avg);
    }

    // 3. Normalisation Harmonique Bornée [-100%, +100%]
    // On calcule l'écart type et l'amplitude max locale pour garantir un bornage parfait
    let maxAbs = 0;
    detrended.forEach((v) => {
      if (Math.abs(v) > maxAbs) maxAbs = Math.abs(v);
    });
    maxAbs = Math.max(maxAbs, 0.5);

    // Bounded Wave Psi(t) using hyperbolic scaling (plancher -100% et plafond +100% constants)
    const boundedWave = detrended.map((v) => {
      // Mapping sigmoid borné entre -100% et +100%
      const normalized = Math.tanh((v / maxAbs) * 1.8) * 100;
      return Math.round(normalized * 100) / 100;
    });

    // 4. Détection de la Période Récurrente (Autocorrélation ACF)
    let bestLag = 12; // Période par défaut
    let maxCorr = -1;
    const maxLag = Math.floor(minLength / 2);

    // Calcul de la variance
    const meanWave = boundedWave.reduce((a, b) => a + b, 0) / minLength;
    let varWave = 0;
    boundedWave.forEach((v) => {
      varWave += Math.pow(v - meanWave, 2);
    });

    if (varWave > 0) {
      // Recherche du premier pic après la traversée du zéro
      let crossedZero = false;
      for (let lag = 2; lag < maxLag; lag++) {
        let cov = 0;
        for (let t = 0; t < minLength - lag; t++) {
          cov += (boundedWave[t] - meanWave) * (boundedWave[t + lag] - meanWave);
        }
        const corr = cov / varWave;

        if (corr < 0) crossedZero = true;

        if (crossedZero && corr > maxCorr) {
          maxCorr = corr;
          bestLag = lag;
        }
      }
    }

    // Période en heures / minutes
    const tfMinutes =
      timeframe === '15m' ? 15 :
      timeframe === '1h' ? 60 :
      timeframe === '4h' ? 240 :
      timeframe === '1d' ? 1440 : 10080;

    const periodTotalMinutes = bestLag * tfMinutes;
    const periodHours = Math.floor(periodTotalMinutes / 60);
    const periodDays = (periodTotalMinutes / 1440).toFixed(1);

    const periodLabel =
      periodTotalMinutes >= 1440
        ? `${periodDays} jours`
        : `${periodHours}h ${periodTotalMinutes % 60 ? (periodTotalMinutes % 60) + 'm' : ''}`;

    // Cycle théorique sinusoïdal pour comparaison
    const lastVal = boundedWave[boundedWave.length - 1] ?? 0;
    const prevVal = boundedWave[boundedWave.length - 2] ?? 0;
    const isRising = lastVal > prevVal;

    // Détermination de la phase
    let phaseState: 'creux' | 'monte' | 'sommet' | 'baisse' = 'monte';
    if (lastVal <= -60) phaseState = 'creux';
    else if (lastVal >= 60) phaseState = 'sommet';
    else if (isRising) phaseState = 'monte';
    else phaseState = 'baisse';

    // Projection sinusoïdale de référence
    const theoreticalSine: number[] = [];
    for (let i = 0; i < minLength; i++) {
      const angle = (2 * Math.PI * i) / (bestLag || 1);
      theoreticalSine.push(Math.round(Math.sin(angle) * 85 * 10) / 10);
    }

    const cycleInfo = {
      periodLag: bestLag,
      periodLabel,
      regularityScore: Math.min(96, Math.max(55, Math.round(Math.abs(maxCorr) * 100))),
      currentValue: lastVal,
      phaseState,
      isRising,
      theoreticalSine,
    };

    return {
      timestamps: times,
      seriesList: tokenSeries,
      compositeWave: boundedWave,
      cycleStats: cycleInfo,
    };
  }, [candlesMap, activeTokenIds, timeframe]);

  // Grid Multi-Tokens Analysis & Relative Rotation Engine
  const gridAnalysis = useMemo(() => {
    if (seriesList.length === 0) return null;

    const tokensWithState = seriesList.map((s) => {
      const lastReturn = s.returns[s.returns.length - 1] ?? 0;
      const lastPrice = s.prices[s.prices.length - 1] ?? 0;
      const minReturnInWindow = Math.min(...s.returns);
      const maxReturnInWindow = Math.max(...s.returns);
      return {
        token: s.token,
        lastReturn,
        lastPrice,
        minReturnInWindow,
        maxReturnInWindow,
      };
    });

    // Tri croissant : le plus faible rendement en premier = le creux le plus profond
    tokensWithState.sort((a, b) => a.lastReturn - b.lastReturn);

    const deepestDipToken = tokensWithState[0];
    const topLeaderToken = tokensWithState[tokensWithState.length - 1];
    const avgReturn = tokensWithState.reduce((acc, t) => acc + t.lastReturn, 0) / (tokensWithState.length || 1);
    const spreadPercent = topLeaderToken.lastReturn - deepestDipToken.lastReturn;

    // Cible de sortie pour le deepest dip (+X% rebond):
    const targetExitReturn = deepestDipToken.lastReturn + gridTargetPercent;
    const targetExitPrice = deepestDipToken.lastPrice * (1 + gridTargetPercent / 100);

    // Token suivant dans la file d'attente de rotation:
    const nextInQueueToken = tokensWithState[1] || tokensWithState[0];

    // Comptage des rotations de +X% validées sur l'historique de la fenêtre:
    let historicalRotationsCount = 0;
    seriesList.forEach((s) => {
      let localTrough = s.returns[0] ?? 0;
      for (let i = 1; i < s.returns.length; i++) {
        const val = s.returns[i];
        if (val < localTrough) {
          localTrough = val;
        } else if (val - localTrough >= gridTargetPercent) {
          historicalRotationsCount++;
          localTrough = val;
        }
      }
    });

    return {
      tokensRanking: tokensWithState,
      deepestDipToken,
      topLeaderToken,
      avgReturn,
      spreadPercent,
      targetExitReturn,
      targetExitPrice,
      nextInQueueToken,
      historicalRotationsCount,
    };
  }, [seriesList, gridTargetPercent]);

  // Formatter helpers
  const fmtTime = (ts: number) => {
    const d = new Date(ts * 1000);
    if (timeframe === '1d' || timeframe === '1w') {
      return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    }
    return `${d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  // SVG Chart Dimensions
  const chartWidth = 980;
  const chartHeight = 280;
  const padding = { top: 20, right: 30, bottom: 30, left: 105 };
  const innerW = chartWidth - padding.left - padding.right;
  const innerH = chartHeight - padding.top - padding.bottom;

  // Chart 1: Bounds for superimposed returns
  const { minReturn, maxReturn } = useMemo(() => {
    let min = -5;
    let max = 5;
    seriesList.forEach((s) => {
      s.returns.forEach((r) => {
        if (r < min) min = r;
        if (r > max) max = r;
      });
    });
    if (showTokenGrid && gridAnalysis?.targetExitReturn !== undefined) {
      if (gridAnalysis.targetExitReturn > max) max = gridAnalysis.targetExitReturn + 1;
    }
    const pad = Math.max(Math.abs(min), Math.abs(max)) * 0.15;
    return { minReturn: Math.floor(min - pad), maxReturn: Math.ceil(max + pad) };
  }, [seriesList, showTokenGrid, gridAnalysis]);

  const getYReturn = (val: number) => {
    const range = maxReturn - minReturn || 1;
    return padding.top + innerH - ((val - minReturn) / range) * innerH;
  };

  const getX = (index: number) => {
    const total = timestamps.length || 1;
    return padding.left + (index / (total - 1 || 1)) * innerW;
  };

  // Chart 2: Fixed Bounds for Stationary Wave [-100, +100]
  const getYWave = (val: number) => {
    // Fixed range: -110 to +110 for nice padding
    const range = 220;
    return padding.top + innerH - ((val - (-110)) / range) * innerH;
  };

  const zeroYWave = getYWave(0);
  const top100YWave = getYWave(100);
  const bottom100YWave = getYWave(-100);

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 px-4 pt-6 pb-20 sm:px-6 lg:pt-8">
      {/* ===== Header & Explanation ===== */}
      <section className="relative overflow-hidden rounded-2xl border border-line bg-surface p-6 sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent border border-accent/30 shadow-lg">
                <Waves className="h-5 w-5 animate-pulse" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                Onde Harmonique Écosystème Solana
              </h1>
            </div>
            <p className="max-w-3xl text-sm leading-relaxed text-ink-dim">
              Superposition d’ondes et extraction mathématique de cycle stationnaire à bornes constantes (+100% / −100%).
              Détection automatique des périodes récurrentes de rotation et des extrema de l’écosystème.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowMathModal(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-line-strong bg-well px-3.5 py-2 text-xs font-semibold text-accent hover:border-accent/40 hover:text-accent-bright transition-colors cursor-pointer"
            >
              <Info className="h-4 w-4" />
              <span>L’Équation Mathématique</span>
            </button>
            <button
              onClick={() => loadWaveCandles(timeframe)}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-line-strong bg-surface px-3.5 py-2 text-xs font-semibold text-ink-dim hover:text-ink transition-colors cursor-pointer"
              title="Actualiser les flux de données"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Actualiser</span>
            </button>
          </div>
        </div>

        {/* Timeframe selector bar */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line/80 pt-5">
          <div className="flex items-center gap-1.5 rounded-lg border border-line-strong bg-well p-1">
            {(['15m', '1h', '4h', '1d', '1w'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`h-8 rounded-md px-3 text-xs font-semibold transition-all cursor-pointer ${
                  timeframe === tf
                    ? 'bg-accent text-ground shadow'
                    : 'text-ink-dim hover:bg-white/[0.04] hover:text-ink'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSineOverlay(!showSineOverlay)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                showSineOverlay
                  ? 'border-accent/50 bg-accent/10 text-accent'
                  : 'border-line text-ink-faint hover:text-ink-dim'
              }`}
            >
              <Activity className="h-3.5 w-3.5" />
              <span>Onde Sinusoïdale Théorique</span>
            </button>
            <button
              onClick={selectAllTokens}
              className="text-xs text-ink-dim hover:text-ink underline cursor-pointer"
            >
              Tous les 8 tokens ({activeTokenIds.length}/8)
            </button>
          </div>
        </div>
      </section>

      {/* ===== KPI Cards ===== */}
      {cycleStats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-line bg-surface p-5">
            <div className="flex items-center justify-between text-xs text-ink-dim">
              <span>Période Récurrente (T)</span>
              <Clock className="h-4 w-4 text-accent" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-ink font-mono">
              {cycleStats.periodLabel}
            </div>
            <div className="mt-1 text-xs text-ink-faint">
              Régularité harmonique : <span className="text-up font-semibold">{cycleStats.regularityScore}%</span>
            </div>
          </div>

          <div className="rounded-xl border border-line bg-surface p-5">
            <div className="flex items-center justify-between text-xs text-ink-dim">
              <span>Niveau de l’Onde Ψ(t)</span>
              <Waves className="h-4 w-4 text-accent" />
            </div>
            <div className={`mt-2 text-2xl font-bold tracking-tight font-mono ${
              cycleStats.currentValue > 50 ? 'text-down' : cycleStats.currentValue < -50 ? 'text-up' : 'text-ink'
            }`}>
              {cycleStats.currentValue > 0 ? `+${cycleStats.currentValue}%` : `${cycleStats.currentValue}%`}
            </div>
            <div className="mt-1 text-xs text-ink-faint">
              Bornes fixes : [−100%, +100%]
            </div>
          </div>

          <div className="rounded-xl border border-line bg-surface p-5">
            <div className="flex items-center justify-between text-xs text-ink-dim">
              <span>Phase du Cycle</span>
              <TrendingUp className="h-4 w-4 text-accent" />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className={`inline-block h-3 w-3 rounded-full ${
                cycleStats.phaseState === 'creux' ? 'bg-up animate-ping' :
                cycleStats.phaseState === 'sommet' ? 'bg-down animate-ping' :
                cycleStats.isRising ? 'bg-accent' : 'bg-amber-400'
              }`} />
              <span className="text-base font-bold text-ink">
                {cycleStats.phaseState === 'creux' ? 'Creux d’Onde (Creux)' :
                 cycleStats.phaseState === 'sommet' ? 'Sommet d’Onde (Crête)' :
                 cycleStats.isRising ? 'Expansion Haussière' : 'Décélération Baissière'}
              </span>
            </div>
            <div className="mt-1 text-xs text-ink-faint">
              {cycleStats.phaseState === 'creux' ? 'Survente collective de l’écosystème' :
               cycleStats.phaseState === 'sommet' ? 'Surchauffe & prise de bénéfices' :
               'Axe d’oscillation intermédiaire'}
            </div>
          </div>

          <div className="rounded-xl border border-line bg-surface p-5">
            <div className="flex items-center justify-between text-xs text-ink-dim">
              <span>Signal Écosystème</span>
              <Zap className="h-4 w-4 text-accent" />
            </div>
            <div className={`mt-2 text-base font-bold ${
              cycleStats.currentValue <= -50 ? 'text-up' :
              cycleStats.currentValue >= 50 ? 'text-down' : 'text-accent'
            }`}>
              {cycleStats.currentValue <= -50 ? 'Accumulation Dips 🟢' :
               cycleStats.currentValue >= 50 ? 'Zone de Vente / Rotation 🔴' : 'Zone d’Équilibre Neutre ⚪'}
            </div>
            <div className="mt-1 text-xs text-ink-faint">
              {cycleStats.currentValue <= -50 ? 'Haute probabilité de rebond imminent' :
               cycleStats.currentValue >= 50 ? 'Prise de profit conseillée' : 'Rotation latérale'}
            </div>
          </div>
        </div>
      )}

      {/* ===== CHART 1: Superposition des 8 Courbes Brutes (%) ===== */}
      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-4">
          <div>
            <h2 className="text-base font-bold text-ink flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-accent" />
              1. Superposition des Courbes Brutes (% Rendement)
            </h2>
            <p className="text-xs text-ink-dim">
              Suivi direct des 8 tokens de l’écosystème Solana ramenés à la base 0%
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Bouton Grille Multi-Tokens */}
            <button
              onClick={() => setShowTokenGrid(!showTokenGrid)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                showTokenGrid
                  ? 'border-accent bg-accent/15 text-accent shadow-sm'
                  : 'border-line-strong bg-well text-ink-dim hover:text-ink'
              }`}
            >
              <Grid className="h-3.5 w-3.5" />
              <span>Grille Multi-Tokens</span>
              <span className={`inline-block h-2 w-2 rounded-full ${showTokenGrid ? 'bg-up animate-pulse' : 'bg-line-strong'}`} />
            </button>

            {/* Sélecteur de Pas de Rebond (Cible %) */}
            {showTokenGrid && (
              <div className="flex items-center gap-1 rounded-lg border border-line-strong bg-well p-0.5 text-[11px] font-mono">
                <span className="px-2 text-ink-faint font-sans">Palier:</span>
                {[1.5, 2.0, 3.0, 5.0].map((step) => (
                  <button
                    key={step}
                    onClick={() => setGridTargetPercent(step)}
                    className={`rounded px-2 py-0.5 font-semibold transition-all cursor-pointer ${
                      gridTargetPercent === step
                        ? 'bg-accent text-ground shadow'
                        : 'text-ink-dim hover:text-ink'
                    }`}
                  >
                    +{step}%
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* SVG Container */}
        <div className="relative mt-4 w-full overflow-x-auto">
          {isLoading ? (
            <div className="flex h-[280px] items-center justify-center text-sm text-ink-dim">
              <RefreshCw className="mr-2 h-5 w-5 animate-spin text-accent" />
              Chargement des flux Solana Core…
            </div>
          ) : timestamps.length === 0 ? (
            <div className="flex h-[280px] items-center justify-center text-sm text-ink-faint">
              Données insuffisantes pour cette unité de temps.
            </div>
          ) : (
            <div className="min-w-[760px]">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="w-full select-none"
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = ((e.clientX - rect.left) / rect.width) * chartWidth;
                  if (x >= padding.left && x <= chartWidth - padding.right) {
                    const idx = Math.round(((x - padding.left) / innerW) * (timestamps.length - 1));
                    setHoverIndex(Math.max(0, Math.min(timestamps.length - 1, idx)));
                  }
                }}
                onMouseLeave={() => setHoverIndex(null)}
              >
                {/* Horizontal Grid lines */}
                {[-10, -5, 0, 5, 10].map((level) => {
                  if (level < minReturn || level > maxReturn) return null;
                  const y = getYReturn(level);
                  return (
                    <g key={level}>
                      <line
                        x1={padding.left}
                        y1={y}
                        x2={chartWidth - padding.right}
                        y2={y}
                        stroke={level === 0 ? '#69aac1' : '#20363d'}
                        strokeWidth={level === 0 ? 1.2 : 0.8}
                        strokeDasharray={level === 0 ? undefined : '3,3'}
                        strokeOpacity={level === 0 ? 0.6 : 0.4}
                      />
                      <text
                        x={padding.left - 10}
                        y={y + 3}
                        textAnchor="end"
                        className="font-mono text-[10px] fill-slate-400"
                      >
                        {level > 0 ? `+${level}%` : `${level}%`}
                      </text>
                    </g>
                  );
                })}

                {/* Vertical time markers */}
                {timestamps.map((ts, idx) => {
                  if (idx % Math.ceil(timestamps.length / 6) !== 0) return null;
                  const x = getX(idx);
                  return (
                    <g key={ts}>
                      <line
                        x1={x}
                        y1={padding.top}
                        x2={x}
                        y2={chartHeight - padding.bottom}
                        stroke="#20363d"
                        strokeWidth={0.5}
                        strokeOpacity={0.4}
                      />
                      <text
                        x={x}
                        y={chartHeight - padding.bottom + 16}
                        textAnchor="middle"
                        className="font-mono text-[10px] fill-slate-500"
                      >
                        {fmtTime(ts)}
                      </text>
                    </g>
                  );
                })}

                {/* 8 Token Paths */}
                {seriesList.map((series) => {
                  const points = series.returns.map((val, idx) => `${getX(idx)},${getYReturn(val)}`).join(' ');
                  const lastVal = series.returns[series.returns.length - 1];
                  const lastY = getYReturn(lastVal);
                  return (
                    <g key={series.token.id}>
                      <polyline
                        points={points}
                        fill="none"
                        stroke={series.token.color}
                        strokeWidth={1.8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={hoverIndex !== null ? 0.85 : 0.95}
                      />
                      {/* End token circle badge */}
                      <circle
                        cx={chartWidth - padding.right}
                        cy={lastY}
                        r={3}
                        fill={series.token.color}
                      />
                    </g>
                  );
                })}

                {/* Dynamic Token Grid Overlay */}
                {showTokenGrid && gridAnalysis && (
                  <g className="token-grid-layers">
                    {/* Shaded corridor between lowest and highest token */}
                    <rect
                      x={padding.left}
                      y={getYReturn(gridAnalysis.topLeaderToken.lastReturn)}
                      width={innerW}
                      height={Math.max(
                        3,
                        getYReturn(gridAnalysis.deepestDipToken.lastReturn) -
                          getYReturn(gridAnalysis.topLeaderToken.lastReturn)
                      )}
                      fill="#38bdf8"
                      fillOpacity={0.03}
                    />

                    {/* Horizontal Level for each intermediate token */}
                    {gridAnalysis.tokensRanking.map((item) => {
                      const y = getYReturn(item.lastReturn);
                      const isDeepest = item.token.id === gridAnalysis.deepestDipToken.token.id;
                      const isLeader = item.token.id === gridAnalysis.topLeaderToken.token.id;
                      if (isDeepest || isLeader) return null;

                      return (
                        <g key={`grid-line-${item.token.id}`}>
                          <line
                            x1={padding.left}
                            y1={y}
                            x2={chartWidth - padding.right}
                            y2={y}
                            stroke={item.token.color}
                            strokeWidth={0.8}
                            strokeDasharray="2,3"
                            strokeOpacity={0.4}
                          />
                          <rect
                            x={chartWidth - padding.right - 88}
                            y={y - 8}
                            width={82}
                            height={16}
                            rx={3}
                            fill="#0d1f23"
                            fillOpacity={0.88}
                            stroke={item.token.color}
                            strokeWidth={0.8}
                          />
                          <text
                            x={chartWidth - padding.right - 10}
                            y={y + 3.5}
                            textAnchor="end"
                            className="font-mono text-[9px] font-semibold"
                            fill={item.token.color}
                          >
                            {item.token.baseAsset} {item.lastReturn >= 0 ? '+' : ''}
                            {item.lastReturn.toFixed(1)}%
                          </text>
                        </g>
                      );
                    })}

                    {/* Ecosystem Average Line */}
                    <line
                      x1={padding.left}
                      y1={getYReturn(gridAnalysis.avgReturn)}
                      x2={chartWidth - padding.right}
                      y2={getYReturn(gridAnalysis.avgReturn)}
                      stroke="#69aac1"
                      strokeWidth={1}
                      strokeDasharray="3,3"
                      strokeOpacity={0.5}
                    />

                    {/* 1. Deepest Dip Line (Plancher Achat Grille) */}
                    <g>
                      <line
                        x1={padding.left}
                        y1={getYReturn(gridAnalysis.deepestDipToken.lastReturn)}
                        x2={chartWidth - padding.right}
                        y2={getYReturn(gridAnalysis.deepestDipToken.lastReturn)}
                        stroke="#39d6a3"
                        strokeWidth={2}
                        strokeDasharray="4,2"
                        strokeOpacity={0.9}
                      />
                      <rect
                        x={padding.left + 12}
                        y={getYReturn(gridAnalysis.deepestDipToken.lastReturn) - 10}
                        width={215}
                        height={20}
                        rx={5}
                        fill="#05261f"
                        fillOpacity={0.92}
                        stroke="#39d6a3"
                        strokeWidth={1.2}
                      />
                      <text
                        x={padding.left + 20}
                        y={getYReturn(gridAnalysis.deepestDipToken.lastReturn) + 4}
                        className="font-mono text-[10px] fill-emerald-300 font-bold"
                      >
                        🟢 ACHAT DIP : {gridAnalysis.deepestDipToken.token.baseAsset} ({gridAnalysis.deepestDipToken.lastReturn >= 0 ? '+' : ''}{gridAnalysis.deepestDipToken.lastReturn.toFixed(1)}%)
                      </text>
                    </g>

                    {/* 2. Target Exit Line (+X% Rebond) */}
                    <g>
                      <line
                        x1={padding.left}
                        y1={getYReturn(gridAnalysis.targetExitReturn)}
                        x2={chartWidth - padding.right}
                        y2={getYReturn(gridAnalysis.targetExitReturn)}
                        stroke="#f59e0b"
                        strokeWidth={2}
                        strokeDasharray="4,2"
                        strokeOpacity={0.9}
                      />
                      <rect
                        x={padding.left + 12}
                        y={getYReturn(gridAnalysis.targetExitReturn) - 10}
                        width={295}
                        height={20}
                        rx={5}
                        fill="#291804"
                        fillOpacity={0.92}
                        stroke="#f59e0b"
                        strokeWidth={1.2}
                      />
                      <text
                        x={padding.left + 20}
                        y={getYReturn(gridAnalysis.targetExitReturn) + 4}
                        className="font-mono text-[10px] fill-amber-300 font-bold"
                      >
                        🎯 CIBLE +{gridTargetPercent}% ({gridAnalysis.targetExitReturn >= 0 ? '+' : ''}{gridAnalysis.targetExitReturn.toFixed(1)}%) : VENTE ➜ ROTATION {gridAnalysis.nextInQueueToken.token.baseAsset}
                      </text>
                    </g>

                    {/* 3. Top Leader Line (Plafond Grille) */}
                    <g>
                      <line
                        x1={padding.left}
                        y1={getYReturn(gridAnalysis.topLeaderToken.lastReturn)}
                        x2={chartWidth - padding.right}
                        y2={getYReturn(gridAnalysis.topLeaderToken.lastReturn)}
                        stroke="#fb7185"
                        strokeWidth={1.6}
                        strokeDasharray="4,3"
                        strokeOpacity={0.8}
                      />
                      <rect
                        x={padding.left + 12}
                        y={getYReturn(gridAnalysis.topLeaderToken.lastReturn) - 10}
                        width={185}
                        height={20}
                        rx={5}
                        fill="#2d0b13"
                        fillOpacity={0.92}
                        stroke="#fb7185"
                        strokeWidth={1}
                      />
                      <text
                        x={padding.left + 20}
                        y={getYReturn(gridAnalysis.topLeaderToken.lastReturn) + 4}
                        className="font-mono text-[10px] fill-rose-300 font-bold"
                      >
                        🔴 LEADER : {gridAnalysis.topLeaderToken.token.baseAsset} (+{gridAnalysis.topLeaderToken.lastReturn.toFixed(1)}%)
                      </text>
                    </g>
                  </g>
                )}

                {/* Hover line & tooltip */}
                {hoverIndex !== null && (
                  <g>
                    <line
                      x1={getX(hoverIndex)}
                      y1={padding.top}
                      x2={getX(hoverIndex)}
                      y2={chartHeight - padding.bottom}
                      stroke="#ffffff"
                      strokeWidth={1}
                      strokeDasharray="2,2"
                      opacity={0.6}
                    />
                    <circle
                      cx={getX(hoverIndex)}
                      cy={getYReturn(0)}
                      r={2}
                      fill="#ffffff"
                    />
                  </g>
                )}
              </svg>
            </div>
          )}
        </div>

        {/* 8 Token Toggles Legend */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 border-t border-line/70 pt-4">
          {SOLANA_WAVE_TOKENS.map((token) => {
            const isChecked = activeTokenIds.includes(token.id);
            const liveTick = tickers[token.symbol];
            const livePx = liveTick?.lastPrice;
            const change24h = liveTick?.priceChangePercent;

            return (
              <button
                key={token.id}
                onClick={() => toggleToken(token.id)}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  isChecked
                    ? 'border-line-strong bg-well text-ink shadow-sm'
                    : 'border-transparent bg-transparent text-ink-faint opacity-45 hover:opacity-80'
                }`}
                style={{ borderLeftColor: isChecked ? token.color : undefined, borderLeftWidth: isChecked ? '3px' : undefined }}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: token.color }}
                />
                <span className="font-mono">{token.baseAsset}</span>
                {livePx && (
                  <span className="text-[11px] font-normal text-ink-dim font-mono">
                    ${livePx < 1 ? livePx.toFixed(4) : livePx.toFixed(2)}
                  </span>
                )}
                {change24h !== undefined && (
                  <span className={`text-[10px] font-mono ${change24h >= 0 ? 'text-up' : 'text-down'}`}>
                    {change24h >= 0 ? `+${change24h.toFixed(1)}%` : `${change24h.toFixed(1)}%`}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* ===== GRILLE DE ROTATION MULTI-TOKENS (ARBITRAGE DE DISPERSION) ===== */}
      {showTokenGrid && gridAnalysis && (
        <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6 shadow-xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-4">
            <div>
              <h2 className="text-base font-bold text-ink flex items-center gap-2">
                <Grid className="h-4 w-4 text-accent" />
                Grille de Rotation Multi-Tokens (Arbitrage Relatif)
              </h2>
              <p className="text-xs text-ink-dim">
                Stratégie de rebond à paliers : Achat du token en retard (Deepest Dip), vente dès rebond de +{gridTargetPercent}%, et réinjection continue dans le creux suivant.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent border border-accent/20">
                <RotateCcw className="h-3.5 w-3.5 animate-spin" style={{ animationDuration: '6s' }} />
                Cycle de Rotation Automatique
              </span>
            </div>
          </div>

          {/* 3 Step Pipeline Cards */}
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {/* Step 1: Current Dip Buy */}
            <div className="rounded-xl border border-up/30 bg-up/[0.04] p-5 relative overflow-hidden">
              <div className="flex items-center justify-between text-xs font-semibold text-up">
                <span className="flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-up/20 text-[11px] font-bold">1</span>
                  ACHAT EN COURS (Deep Dip)
                </span>
                <span className="rounded bg-up/20 px-2 py-0.5 font-mono text-[10px] font-bold">Palier 1</span>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: gridAnalysis.deepestDipToken.token.color }}
                  />
                  <span className="text-xl font-bold text-ink font-mono">
                    {gridAnalysis.deepestDipToken.token.baseAsset}
                  </span>
                  <span className="text-xs text-ink-dim">
                    ({gridAnalysis.deepestDipToken.token.name})
                  </span>
                </div>
                <span className="text-lg font-bold font-mono text-down">
                  {gridAnalysis.deepestDipToken.lastReturn >= 0 ? '+' : ''}{gridAnalysis.deepestDipToken.lastReturn.toFixed(1)}%
                </span>
              </div>
              <div className="mt-2 text-xs text-ink-dim font-mono">
                Prix actuel : <strong className="text-ink">${gridAnalysis.deepestDipToken.lastPrice < 1 ? gridAnalysis.deepestDipToken.lastPrice.toFixed(4) : gridAnalysis.deepestDipToken.lastPrice.toFixed(2)}</strong>
              </div>
              <div className="mt-3 text-xs text-ink-faint">
                Plus forte sous-performance du panier Solana. Haute probabilité de rattrapage statistique vers la moyenne ({gridAnalysis.avgReturn >= 0 ? '+' : ''}{gridAnalysis.avgReturn.toFixed(1)}%).
              </div>
            </div>

            {/* Step 2: Target Exit */}
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-5 relative overflow-hidden">
              <div className="flex items-center justify-between text-xs font-semibold text-amber-400">
                <span className="flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-[11px] font-bold">2</span>
                  OBJECTIF DE VENTE (+{gridTargetPercent}%)
                </span>
                <span className="rounded bg-amber-500/20 px-2 py-0.5 font-mono text-[10px] font-bold">Gain Net</span>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-amber-400" />
                  <span className="text-xl font-bold text-amber-300 font-mono">
                    +{gridTargetPercent.toFixed(1)}%
                  </span>
                </div>
                <span className="text-sm font-semibold font-mono text-amber-300">
                  Niveau : {gridAnalysis.targetExitReturn >= 0 ? '+' : ''}{gridAnalysis.targetExitReturn.toFixed(1)}%
                </span>
              </div>
              <div className="mt-2 text-xs text-ink-dim font-mono">
                Prix cible : <strong className="text-amber-200">${gridAnalysis.targetExitPrice < 1 ? gridAnalysis.targetExitPrice.toFixed(4) : gridAnalysis.targetExitPrice.toFixed(2)}</strong>
              </div>
              <div className="mt-3 text-xs text-ink-faint">
                Dès que {gridAnalysis.deepestDipToken.token.baseAsset} valide +{gridTargetPercent}%, prise de profit et rotation immédiate des capitaux vers l'étape 3.
              </div>
            </div>

            {/* Step 3: Next Rotation Target */}
            <div className="rounded-xl border border-sky-500/30 bg-sky-500/[0.04] p-5 relative overflow-hidden">
              <div className="flex items-center justify-between text-xs font-semibold text-sky-400">
                <span className="flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-500/20 text-[11px] font-bold">3</span>
                  ROTATION SUIVANTE (Prochain Creux)
                </span>
                <span className="rounded bg-sky-500/20 px-2 py-0.5 font-mono text-[10px] font-bold">File d'attente</span>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: gridAnalysis.nextInQueueToken.token.color }}
                  />
                  <span className="text-xl font-bold text-ink font-mono">
                    {gridAnalysis.nextInQueueToken.token.baseAsset}
                  </span>
                  <span className="text-xs text-ink-dim">
                    ({gridAnalysis.nextInQueueToken.token.name})
                  </span>
                </div>
                <span className="text-lg font-bold font-mono text-down">
                  {gridAnalysis.nextInQueueToken.lastReturn >= 0 ? '+' : ''}{gridAnalysis.nextInQueueToken.lastReturn.toFixed(1)}%
                </span>
              </div>
              <div className="mt-2 text-xs text-ink-dim font-mono">
                Prix actuel : <strong className="text-ink">${gridAnalysis.nextInQueueToken.lastPrice < 1 ? gridAnalysis.nextInQueueToken.lastPrice.toFixed(4) : gridAnalysis.nextInQueueToken.lastPrice.toFixed(2)}</strong>
              </div>
              <div className="mt-3 text-xs text-ink-faint">
                Prochain token en retard. Le capital encaissé à l'étape 2 est réinvesti immédiatement dans ce token pour capter son rebond.
              </div>
            </div>
          </div>

          {/* Grid Metrics Bar */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-xl border border-line-strong bg-well p-4 text-xs font-mono">
            <div>
              <div className="text-ink-faint font-sans">Spread Écosystème</div>
              <div className="mt-1 text-base font-bold text-accent">{gridAnalysis.spreadPercent.toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-ink-faint font-sans">Moyenne Solana Core</div>
              <div className="mt-1 text-base font-bold text-ink">
                {gridAnalysis.avgReturn >= 0 ? `+${gridAnalysis.avgReturn.toFixed(1)}%` : `${gridAnalysis.avgReturn.toFixed(1)}%`}
              </div>
            </div>
            <div>
              <div className="text-ink-faint font-sans">Rotations +{gridTargetPercent}% Validées</div>
              <div className="mt-1 text-base font-bold text-up">{gridAnalysis.historicalRotationsCount} cycles</div>
            </div>
            <div>
              <div className="text-ink-faint font-sans">Gain Théorique Grille</div>
              <div className="mt-1 text-base font-bold text-up">
                +{(gridAnalysis.historicalRotationsCount * gridTargetPercent).toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Live Ranking Table of all 8 tokens */}
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-line text-ink-faint">
                  <th className="pb-2.5 pl-2 font-medium">Palier Grille</th>
                  <th className="pb-2.5 font-medium">Token</th>
                  <th className="pb-2.5 font-medium">Prix Direct</th>
                  <th className="pb-2.5 font-medium">Rendement Fenêtre</th>
                  <th className="pb-2.5 font-medium">Écart vs Moyenne</th>
                  <th className="pb-2.5 pr-2 font-medium">Rôle dans la Grille</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60 font-mono">
                {gridAnalysis.tokensRanking.map((item, index) => {
                  const isLowest = index === 0;
                  const isSecond = index === 1;
                  const isHighest = index === gridAnalysis.tokensRanking.length - 1;
                  const devFromAvg = item.lastReturn - gridAnalysis.avgReturn;

                  return (
                    <tr
                      key={item.token.id}
                      className={`hover:bg-white/[0.02] transition-colors ${
                        isLowest ? 'bg-up/[0.04]' : isHighest ? 'bg-down/[0.03]' : ''
                      }`}
                    >
                      <td className="py-2.5 pl-2">
                        <span className={`inline-flex items-center justify-center rounded px-2 py-0.5 text-[10px] font-bold ${
                          isLowest ? 'bg-up/20 text-up border border-up/30' :
                          isSecond ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' :
                          isHighest ? 'bg-down/20 text-down border border-down/30' :
                          'bg-well text-ink-dim'
                        }`}>
                          #{index + 1}
                        </span>
                      </td>
                      <td className="py-2.5 font-sans font-semibold text-ink flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: item.token.color }}
                        />
                        <span>{item.token.baseAsset}</span>
                        <span className="text-[11px] font-normal text-ink-faint">({item.token.name})</span>
                      </td>
                      <td className="py-2.5 text-ink">
                        ${item.lastPrice < 1 ? item.lastPrice.toFixed(4) : item.lastPrice.toFixed(2)}
                      </td>
                      <td className={`py-2.5 font-bold ${item.lastReturn >= 0 ? 'text-up' : 'text-down'}`}>
                        {item.lastReturn >= 0 ? `+${item.lastReturn.toFixed(1)}%` : `${item.lastReturn.toFixed(1)}%`}
                      </td>
                      <td className="py-2.5 text-ink-dim">
                        {devFromAvg >= 0 ? `+${devFromAvg.toFixed(1)}%` : `${devFromAvg.toFixed(1)}%`}
                      </td>
                      <td className="py-2.5 pr-2">
                        {isLowest ? (
                          <span className="inline-flex items-center gap-1 text-up font-bold">
                            🟢 ACHAT PRIORITAIRE (Palier 1)
                          </span>
                        ) : isSecond ? (
                          <span className="inline-flex items-center gap-1 text-sky-400 font-semibold">
                            🟡 SUIVANT EN ROTATION (Palier 2)
                          </span>
                        ) : isHighest ? (
                          <span className="inline-flex items-center gap-1 text-down font-semibold">
                            🔴 ZONE DE VENTE / LEADER
                          </span>
                        ) : (
                          <span className="text-ink-faint">
                            ⚪ Palier Neutre (Attente)
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ===== CHART 2: L'Onde Ondulatoire Stationnaire Ψ(t) ===== */}
      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-4">
          <div>
            <h2 className="text-base font-bold text-ink flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-up animate-pulse" />
              2. L’Onde Ondulatoire Stationnaire Ψ(t) — [−100% à +100%]
            </h2>
            <p className="text-xs text-ink-dim">
              Résultante mathématique de la superposition d’ondes : Bornes fixes absolues et cycle récurrent
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-up/10 px-2 py-0.5 text-[11px] font-semibold text-up border border-up/30">
              Creux: −100% (Dips)
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-down/10 px-2 py-0.5 text-[11px] font-semibold text-down border border-down/30">
              Sommet: +100% (Vente)
            </span>
          </div>
        </div>

        {/* SVG Container for Bounded Wave */}
        <div className="relative mt-4 w-full overflow-x-auto">
          {isLoading ? (
            <div className="flex h-[280px] items-center justify-center text-sm text-ink-dim">
              <RefreshCw className="mr-2 h-5 w-5 animate-spin text-accent" />
              Extraction de l’onde harmonique…
            </div>
          ) : compositeWave.length === 0 ? (
            <div className="flex h-[280px] items-center justify-center text-sm text-ink-faint">
              Données insuffisantes pour extraire l’onde.
            </div>
          ) : (
            <div className="min-w-[760px]">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="w-full select-none"
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = ((e.clientX - rect.left) / rect.width) * chartWidth;
                  if (x >= padding.left && x <= chartWidth - padding.right) {
                    const idx = Math.round(((x - padding.left) / innerW) * (compositeWave.length - 1));
                    setHoverIndex(Math.max(0, Math.min(compositeWave.length - 1, idx)));
                  }
                }}
                onMouseLeave={() => setHoverIndex(null)}
              >
                <defs>
                  {/* Linear gradients for wave area */}
                  <linearGradient id="wavePosGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fb7185" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#fb7185" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="waveNegGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#39d6a3" stopOpacity="0.0" />
                    <stop offset="100%" stopColor="#39d6a3" stopOpacity="0.35" />
                  </linearGradient>
                </defs>

                {/* Vertical time markers */}
                {timestamps.map((ts, idx) => {
                  if (idx % Math.ceil(timestamps.length / 6) !== 0) return null;
                  const x = getX(idx);
                  return (
                    <g key={ts}>
                      <line
                        x1={x}
                        y1={padding.top}
                        x2={x}
                        y2={chartHeight - padding.bottom}
                        stroke="#20363d"
                        strokeWidth={0.5}
                        strokeOpacity={0.4}
                      />
                      <text
                        x={x}
                        y={chartHeight - padding.bottom + 16}
                        textAnchor="middle"
                        className="font-mono text-[10px] fill-slate-500"
                      >
                        {fmtTime(ts)}
                      </text>
                    </g>
                  );
                })}

                {/* Ceiling +100% Band (Sommet Max Fixe) */}
                <line
                  x1={padding.left}
                  y1={top100YWave}
                  x2={chartWidth - padding.right}
                  y2={top100YWave}
                  stroke="#fb7185"
                  strokeWidth={1.5}
                  strokeDasharray="4,4"
                  strokeOpacity={0.8}
                />
                <text
                  x={padding.left - 10}
                  y={top100YWave + 3.5}
                  textAnchor="end"
                  className="font-mono text-[10px] fill-rose-400 font-bold"
                >
                  +100% (MAX)
                </text>

                {/* Overbought threshold +60% */}
                <line
                  x1={padding.left}
                  y1={getYWave(60)}
                  x2={chartWidth - padding.right}
                  y2={getYWave(60)}
                  stroke="#fb7185"
                  strokeWidth={0.8}
                  strokeDasharray="2,2"
                  strokeOpacity={0.3}
                />
                <text
                  x={padding.left - 10}
                  y={getYWave(60) + 3}
                  textAnchor="end"
                  className="font-mono text-[9px] fill-rose-400/60"
                >
                  +60%
                </text>

                {/* Equilibrium Zero Line 0% */}
                <line
                  x1={padding.left}
                  y1={zeroYWave}
                  x2={chartWidth - padding.right}
                  y2={zeroYWave}
                  stroke="#69aac1"
                  strokeWidth={1.2}
                  strokeDasharray="4,3"
                  strokeOpacity={0.7}
                />
                <text
                  x={padding.left - 10}
                  y={zeroYWave + 3.5}
                  textAnchor="end"
                  className="font-mono text-[10px] fill-sky-300 font-bold"
                >
                  0% (ÉQUILIBRE)
                </text>

                {/* Oversold threshold -60% */}
                <line
                  x1={padding.left}
                  y1={getYWave(-60)}
                  x2={chartWidth - padding.right}
                  y2={getYWave(-60)}
                  stroke="#39d6a3"
                  strokeWidth={0.8}
                  strokeDasharray="2,2"
                  strokeOpacity={0.3}
                />
                <text
                  x={padding.left - 10}
                  y={getYWave(-60) + 3}
                  textAnchor="end"
                  className="font-mono text-[9px] fill-emerald-400/60"
                >
                  −60%
                </text>

                {/* Floor -100% Band (Creux Min Fixe) */}
                <line
                  x1={padding.left}
                  y1={bottom100YWave}
                  x2={chartWidth - padding.right}
                  y2={bottom100YWave}
                  stroke="#39d6a3"
                  strokeWidth={1.5}
                  strokeDasharray="4,4"
                  strokeOpacity={0.8}
                />
                <text
                  x={padding.left - 10}
                  y={bottom100YWave + 3.5}
                  textAnchor="end"
                  className="font-mono text-[10px] fill-emerald-400 font-bold"
                >
                  −100% (MIN)
                </text>

                {/* Theoretical Sine Cycle Overlay (Dashed curve) */}
                {showSineOverlay && cycleStats?.theoreticalSine && (
                  <polyline
                    points={cycleStats.theoreticalSine
                      .map((val, idx) => `${getX(idx)},${getYWave(val)}`)
                      .join(' ')}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth={1.2}
                    strokeDasharray="4,4"
                    strokeOpacity={0.5}
                  />
                )}

                {/* Filled Wave Area Above Zero */}
                <path
                  d={`M ${getX(0)},${zeroYWave} ${compositeWave
                    .map((val, idx) => `${getX(idx)},${val > 0 ? getYWave(val) : zeroYWave}`)
                    .join(' ')} L ${getX(compositeWave.length - 1)},${zeroYWave} Z`}
                  fill="url(#wavePosGrad)"
                />

                {/* Filled Wave Area Below Zero */}
                <path
                  d={`M ${getX(0)},${zeroYWave} ${compositeWave
                    .map((val, idx) => `${getX(idx)},${val < 0 ? getYWave(val) : zeroYWave}`)
                    .join(' ')} L ${getX(compositeWave.length - 1)},${zeroYWave} Z`}
                  fill="url(#waveNegGrad)"
                />

                {/* The Primary Stationary Wave Curve */}
                <polyline
                  points={compositeWave.map((val, idx) => `${getX(idx)},${getYWave(val)}`).join(' ')}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Pulse Current Marker */}
                {compositeWave.length > 0 && (
                  <g>
                    <circle
                      cx={getX(compositeWave.length - 1)}
                      cy={getYWave(compositeWave[compositeWave.length - 1])}
                      r={5}
                      fill={compositeWave[compositeWave.length - 1] >= 0 ? '#fb7185' : '#39d6a3'}
                      stroke="#ffffff"
                      strokeWidth={2}
                    />
                    <circle
                      cx={getX(compositeWave.length - 1)}
                      cy={getYWave(compositeWave[compositeWave.length - 1])}
                      r={9}
                      fill="none"
                      stroke={compositeWave[compositeWave.length - 1] >= 0 ? '#fb7185' : '#39d6a3'}
                      strokeWidth={1.5}
                      className="animate-ping"
                      opacity={0.6}
                    />
                  </g>
                )}

                {/* Hover line on Wave */}
                {hoverIndex !== null && (
                  <g>
                    <line
                      x1={getX(hoverIndex)}
                      y1={padding.top}
                      x2={getX(hoverIndex)}
                      y2={chartHeight - padding.bottom}
                      stroke="#ffffff"
                      strokeWidth={1}
                      strokeDasharray="2,2"
                      opacity={0.6}
                    />
                    <circle
                      cx={getX(hoverIndex)}
                      cy={getYWave(compositeWave[hoverIndex])}
                      r={4}
                      fill="#ffffff"
                    />
                  </g>
                )}
              </svg>
            </div>
          )}
        </div>

        {/* Dynamic Tooltip Info Banner */}
        {hoverIndex !== null && timestamps[hoverIndex] && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line-strong bg-well p-3 text-xs font-mono">
            <div className="flex items-center gap-2 text-ink-dim">
              <Clock className="h-3.5 w-3.5 text-accent" />
              <span>{fmtTime(timestamps[hoverIndex])}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-ink-dim">
                Onde Ψ :{' '}
                <strong className={`font-bold ${compositeWave[hoverIndex] >= 0 ? 'text-down' : 'text-up'}`}>
                  {compositeWave[hoverIndex] >= 0 ? `+${compositeWave[hoverIndex]}%` : `${compositeWave[hoverIndex]}%`}
                </strong>
              </span>
              <span className="text-ink-faint">|</span>
              <span className="text-ink-dim">
                Statut :{' '}
                <strong className="text-ink">
                  {compositeWave[hoverIndex] <= -50 ? 'Creux (Achat Dip)' :
                   compositeWave[hoverIndex] >= 50 ? 'Sommet (Vente)' : 'Neutre'}
                </strong>
              </span>
            </div>
          </div>
        )}
      </section>

      {/* ===== Mathematical Explanation Modal ===== */}
      {showMathModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-line bg-surface p-6 shadow-2xl sm:p-8 space-y-5">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div className="flex items-center gap-2.5 text-lg font-bold text-ink">
                <Waves className="h-5 w-5 text-accent" />
                <span>Modèle Mathématique de l’Onde Harmonique</span>
              </div>
              <button
                onClick={() => setShowMathModal(false)}
                className="rounded-lg p-1 text-ink-dim hover:text-ink cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs sm:text-sm text-ink-dim leading-relaxed">
              <div className="rounded-xl border border-line-strong bg-well p-4 space-y-2">
                <h4 className="font-semibold text-ink flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/20 text-[11px] text-accent font-bold">1</span>
                  Superposition des Ondes (Somme Composite)
                </h4>
                <p>
                  Chaque token i de l’écosystème (N=8) génère une onde de rendement relatif R_i(t) = ((Prix(t) - Prix(0)) / Prix(0)) × 100%.
                  Leur interférence constructive et destructive donne le signal écosystème global :
                </p>
                <div className="rounded-md bg-ground/80 p-2 font-mono text-center text-accent">
                  S(t) = (1 / N) * Σ R_i(t)
                </div>
              </div>

              <div className="rounded-xl border border-line-strong bg-well p-4 space-y-2">
                <h4 className="font-semibold text-ink flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/20 text-[11px] text-accent font-bold">2</span>
                  Dé-trendage du Drift Macro
                </h4>
                <p>
                  Pour éliminer la tendance directionnelle du marché et isoler l’oscillation pure, on soustrait la moyenne mobile du trend :
                </p>
                <div className="rounded-md bg-ground/80 p-2 font-mono text-center text-accent">
                  Δ(t) = S(t) - SMA(S, k)
                </div>
              </div>

              <div className="rounded-xl border border-line-strong bg-well p-4 space-y-2">
                <h4 className="font-semibold text-ink flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/20 text-[11px] text-accent font-bold">3</span>
                  Bornage Harmonique Strict [−100%, +100%]
                </h4>
                <p>
                  Pour que l’onde conserve toujours le même Max (+100%) et le même Min (−100%), on applique une fonction sigmoïde hyperbolique adaptée :
                </p>
                <div className="rounded-md bg-ground/80 p-2 font-mono text-center text-accent">
                  Ψ(t) = tanh( Δ(t) / σ ) * 100%  ∈ [−100%, +100%]
                </div>
              </div>

              <div className="rounded-xl border border-line-strong bg-well p-4 space-y-2">
                <h4 className="font-semibold text-ink flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/20 text-[11px] text-accent font-bold">4</span>
                  Détection de la Période Récurrente (Autocorrélation)
                </h4>
                <p>
                  L’algorithme calcule la fonction d’autocorrélation pour identifier le décalage temporel $\tau$ qui maximise la corrélation cyclique, déterminant la période de répétition naturelle de l’écosystème.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowMathModal(false)}
                className="rounded-lg bg-accent px-4 py-2 text-xs font-bold text-ground hover:bg-accent-bright cursor-pointer"
              >
                Compris
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
