import React, { useState, useMemo } from 'react';
import type { TickerData, CandleData, Stats30d, Timeframe, ChartType } from '../types/crypto';
import {
  CROSS_TOKENS,
  SYNTHETIC_PAIRS,
  buildSyntheticPair,
  calculateSyntheticCandles,
  calculateSyntheticTicker,
  calculateSynthetic30dStats,
  getDynamicPrecision,
  type SyntheticPairConfig,
} from '../config/crossPairs';
import { SyntheticPairChart } from './SyntheticPairChart';
import {
  ArrowLeftRight,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Activity,
  Calculator,
  Compass,
  Check,
} from 'lucide-react';

interface CrossPairsPageProps {
  tickers: Record<string, TickerData>;
  multiCandles: Record<string, CandleData[]>;
  stats30dMap?: Record<string, Stats30d>;
}

export const CrossPairsPage: React.FC<CrossPairsPageProps> = ({
  tickers,
  multiCandles,
  stats30dMap = {},
}) => {
  // 1. Selected Custom Pair state (Defaults to SUI / SOL)
  const [baseTokenId, setBaseTokenId] = useState<string>('sui');
  const [quoteTokenId, setQuoteTokenId] = useState<string>('sol');

  // 2. Chart controls state
  const [timeframe, setTimeframe] = useState<Timeframe>('1h');
  const [chartType, setChartType] = useState<ChartType>('candlestick');
  const [showMA, setShowMA] = useState<boolean>(true);
  const [showBollinger, setShowBollinger] = useState<boolean>(false);
  const [showVolume, setShowVolume] = useState<boolean>(true);

  // 3. Category filter for the 15 pre-configured cards gallery
  const [galleryCategory, setGalleryCategory] = useState<'all' | 'vs-sol' | 'vs-hype' | 'vs-sui' | 'cross-alts'>('all');

  // 4. Rotation simulation amount
  const [swapSimAmount, setSwapSimAmount] = useState<number>(1000);

  // Resolve base and quote tokens
  const baseToken = useMemo(() => {
    return CROSS_TOKENS.find((t) => t.id === baseTokenId) || CROSS_TOKENS[1]; // SUI
  }, [baseTokenId]);

  const quoteToken = useMemo(() => {
    return CROSS_TOKENS.find((t) => t.id === quoteTokenId) || CROSS_TOKENS[0]; // SOL
  }, [quoteTokenId]);

  // Active Pair configuration
  const activePair: SyntheticPairConfig = useMemo(() => {
    return buildSyntheticPair(baseToken, quoteToken);
  }, [baseToken, quoteToken]);

  // Swap / Invert Base and Quote tokens
  const handleInvertPair = () => {
    const prevBase = baseTokenId;
    setBaseTokenId(quoteTokenId);
    setQuoteTokenId(prevBase);
  };

  // Select a pre-configured pair
  const handleSelectPair = (pair: SyntheticPairConfig) => {
    setBaseTokenId(pair.baseToken.id);
    setQuoteTokenId(pair.quoteToken.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Base and Quote tickers
  const tickerA = tickers[baseToken.symbol];
  const tickerB = tickers[quoteToken.symbol];

  // Live Synthetic Ticker
  const activeSyntheticTicker = useMemo(() => {
    return calculateSyntheticTicker(tickerA, tickerB);
  }, [tickerA, tickerB]);

  // Base and Quote candles
  const candlesA = multiCandles[baseToken.symbol] || [];
  const candlesB = multiCandles[quoteToken.symbol] || [];

  // Live Synthetic Candles
  const syntheticCandles = useMemo(() => {
    return calculateSyntheticCandles(candlesA, candlesB);
  }, [candlesA, candlesB]);

  // Base and Quote 30D stats
  const statA = stats30dMap[baseToken.symbol];
  const statB = stats30dMap[quoteToken.symbol];

  const synthetic30dStats = useMemo(() => {
    return calculateSynthetic30dStats(statA, statB, activeSyntheticTicker.ratio);
  }, [statA, statB, activeSyntheticTicker.ratio]);

  const precision = getDynamicPrecision(activeSyntheticTicker.ratio);

  // 24h Range Bar %
  const rangeSpan = activeSyntheticTicker.high24h - activeSyntheticTicker.low24h;
  const rangePct =
    rangeSpan > 0
      ? Math.min(
          Math.max(
            ((activeSyntheticTicker.ratio - activeSyntheticTicker.low24h) / rangeSpan) * 100,
            0
          ),
          100
        )
      : 50;

  // Filter 15 pairs for gallery
  const filteredPairs = useMemo(() => {
    if (galleryCategory === 'all') return SYNTHETIC_PAIRS;
    return SYNTHETIC_PAIRS.filter((p) => p.category === galleryCategory);
  }, [galleryCategory]);

  return (
    <div className="flex-1 flex flex-col bg-[#090d14] p-4 lg:p-6 space-y-6">
      {/* 1. HERO BAR & INTERACTIVE PAIR BUILDER */}
      <div className="bg-gradient-to-r from-[#0d121c] via-[#0f172a] to-[#0d121c] border border-slate-800 rounded-3xl p-5 lg:p-6 shadow-2xl relative overflow-hidden">
        {/* Glow ambient background accents */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Pair Identity & Interactive Dropdown Selectors */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 shadow-md shadow-indigo-400/50" />
              <span className="text-[11px] uppercase tracking-wider font-extrabold text-indigo-400">
                Paire Synthétique • Ratio Cross-Crypto
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono border border-slate-700">
                Token1 ÷ Token2
              </span>
            </div>

            {/* Token Pickers Bar with Invert Button */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Token A Selector */}
              <div className="flex items-center gap-2 bg-[#090d14] border border-slate-700/80 p-2 rounded-2xl shadow-inner">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-md bg-gradient-to-br ${baseToken.accentGradient}`}
                >
                  {baseToken.baseAsset.slice(0, 3)}
                </div>
                <div className="flex flex-col pr-2">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Token A (Base)</span>
                  <select
                    value={baseTokenId}
                    onChange={(e) => {
                      const newId = e.target.value;
                      if (newId === quoteTokenId) {
                        setQuoteTokenId(baseTokenId);
                      }
                      setBaseTokenId(newId);
                    }}
                    className="bg-transparent text-sm font-bold text-white focus:outline-none cursor-pointer pr-1"
                  >
                    {CROSS_TOKENS.map((t) => (
                      <option key={t.id} value={t.id} className="bg-slate-900 text-white">
                        {t.name} ({t.baseAsset})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Invert Button */}
              <button
                onClick={handleInvertPair}
                className="p-2.5 rounded-2xl bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/40 hover:border-indigo-400 transition-all duration-200 cursor-pointer shadow-md group"
                title="Inverser le Ratio (A ⇄ B)"
              >
                <ArrowLeftRight className="w-5 h-5 group-hover:rotate-180 transition-transform duration-300" />
              </button>

              {/* Token B Selector */}
              <div className="flex items-center gap-2 bg-[#090d14] border border-slate-700/80 p-2 rounded-2xl shadow-inner">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-md bg-gradient-to-br ${quoteToken.accentGradient}`}
                >
                  {quoteToken.baseAsset.slice(0, 3)}
                </div>
                <div className="flex flex-col pr-2">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Token B (Quote)</span>
                  <select
                    value={quoteTokenId}
                    onChange={(e) => {
                      const newId = e.target.value;
                      if (newId === baseTokenId) {
                        setBaseTokenId(quoteTokenId);
                      }
                      setQuoteTokenId(newId);
                    }}
                    className="bg-transparent text-sm font-bold text-white focus:outline-none cursor-pointer pr-1"
                  >
                    {CROSS_TOKENS.map((t) => (
                      <option key={t.id} value={t.id} className="bg-slate-900 text-white">
                        {t.name} ({t.baseAsset})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-400 max-w-xl">
              <strong className="text-slate-200">{activePair.narrative}</strong> : {activePair.description}
            </p>
          </div>

          {/* Big Live Ratio Metrics Display */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 bg-[#090d14]/80 border border-slate-800 p-4 lg:p-5 rounded-2xl shadow-inner">
            <div>
              <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
                <span>Ratio Actuel ({activePair.symbol})</span>
                <span className="text-[10px] text-slate-500">
                  (${tickerA?.lastPrice?.toFixed(2) || '0'} ÷ ${tickerB?.lastPrice?.toFixed(2) || '0'})
                </span>
              </div>
              <div className="text-3xl lg:text-4xl font-black font-mono tracking-tight text-white flex items-baseline gap-2 mt-1">
                <span>
                  {activeSyntheticTicker.ratio < 1
                    ? activeSyntheticTicker.ratio.toFixed(precision)
                    : activeSyntheticTicker.ratio.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: precision,
                      })}
                </span>
                <span className="text-xs font-semibold text-indigo-300 font-sans">
                  {quoteToken.baseAsset}
                </span>
              </div>
            </div>

            <div className="h-12 w-[1px] bg-slate-800 hidden sm:block" />

            <div className="flex flex-col gap-1.5 min-w-[140px]">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">
                Surperformance 24h
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 text-sm font-bold font-mono px-2 py-0.5 rounded-lg ${
                    activeSyntheticTicker.change24hPercent >= 0
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {activeSyntheticTicker.change24hPercent >= 0 ? (
                    <TrendingUp className="w-3.5 h-3.5" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5" />
                  )}
                  {activeSyntheticTicker.change24hPercent >= 0 ? '+' : ''}
                  {activeSyntheticTicker.change24hPercent.toFixed(2)}%
                </span>
              </div>

              {/* Leader Badge */}
              <div className="text-[11px] font-semibold text-slate-300">
                {activeSyntheticTicker.leader === 'base' ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    🟢 {baseToken.baseAsset} surperforme {quoteToken.baseAsset}
                  </span>
                ) : activeSyntheticTicker.leader === 'quote' ? (
                  <span className="text-rose-400 flex items-center gap-1">
                    🔴 {quoteToken.baseAsset} plus fort que {baseToken.baseAsset}
                  </span>
                ) : (
                  <span className="text-slate-400">Équilibre parfait</span>
                )}
              </div>
            </div>

            <div className="h-12 w-[1px] bg-slate-800 hidden sm:block" />

            {/* 24h Range Bar */}
            <div className="flex flex-col gap-1 min-w-[150px]">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span>24h Low: {activeSyntheticTicker.low24h.toFixed(precision)}</span>
                <span>24h High: {activeSyntheticTicker.high24h.toFixed(precision)}</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden relative">
                <div
                  className="bg-gradient-to-r from-indigo-500 to-teal-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${rangePct}%` }}
                />
              </div>
              {synthetic30dStats.dropFromHighPct < 0 && (
                <div className="text-[10px] text-amber-400 font-mono mt-0.5">
                  Écart Sommet 30J: {synthetic30dStats.dropFromHighPct.toFixed(1)}%
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. MAIN SYNTHETIC CANDLESTICK CHART */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white tracking-tight m-0">
              Charte Candlestick Synthétique • {activePair.displaySymbol}
            </h3>
            <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30 font-mono">
              Lightweight Charts Live
            </span>
          </div>
          <span className="text-xs text-slate-400 font-mono hidden sm:inline">
            1 {baseToken.baseAsset} = {activeSyntheticTicker.ratio.toFixed(precision)} {quoteToken.baseAsset}
          </span>
        </div>

        <SyntheticPairChart
          pair={activePair}
          data={syntheticCandles}
          timeframe={timeframe}
          setTimeframe={setTimeframe}
          chartType={chartType}
          setChartType={setChartType}
          showMA={showMA}
          setShowMA={setShowMA}
          showBollinger={showBollinger}
          setShowBollinger={setShowBollinger}
          showVolume={showVolume}
          setShowVolume={setShowVolume}
        />
      </div>

      {/* 3. ROTATION & ARBITRAGE SIMULATOR */}
      <div className="bg-[#0b0e14] border border-slate-800 p-5 rounded-2xl space-y-4 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white m-0">
                Simulateur de Rotation d'Arbitrage • {activePair.displaySymbol}
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Calcul du retour potentiel en échangeant directement entre {baseToken.baseAsset} et {quoteToken.baseAsset}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-[#090d14] px-3 py-1.5 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400 font-semibold">Montant Simulé:</span>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">$</span>
              <input
                type="number"
                value={swapSimAmount}
                onChange={(e) => setSwapSimAmount(Math.max(10, Number(e.target.value)))}
                className="w-24 bg-slate-900 border border-slate-700 rounded-lg pl-6 pr-2 py-1 text-xs text-white font-mono font-bold focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#0e131d] p-3.5 rounded-xl border border-slate-800/80 flex flex-col justify-between">
            <span className="text-[11px] text-slate-400">Position 24h du Ratio</span>
            <div className="text-base font-bold font-mono text-white mt-1">
              {rangePct > 70 ? (
                <span className="text-emerald-400">🔥 Haut de Range 24h ({rangePct.toFixed(0)}%)</span>
              ) : rangePct < 30 ? (
                <span className="text-amber-400">❄️ Bas de Range 24h ({rangePct.toFixed(0)}%)</span>
              ) : (
                <span className="text-slate-300">⚖️ Zone Médiane ({rangePct.toFixed(0)}%)</span>
              )}
            </div>
            <span className="text-[10px] text-slate-500 mt-1">
              {rangePct > 70
                ? `${baseToken.baseAsset} est cher par rapport à ${quoteToken.baseAsset} sur 24h`
                : `${baseToken.baseAsset} offre un point d'entrée avantageux face à ${quoteToken.baseAsset}`}
            </span>
          </div>

          <div className="bg-[#0e131d] p-3.5 rounded-xl border border-slate-800/80 flex flex-col justify-between">
            <span className="text-[11px] text-slate-400">Écart vs Sommet 30 Jours</span>
            <div className="text-base font-bold font-mono text-indigo-300 mt-1">
              {synthetic30dStats.dropFromHighPct.toFixed(2)}%
            </div>
            <span className="text-[10px] text-slate-500 mt-1">
              Potentiel de rebond si le ratio retrouve son plus haut du mois
            </span>
          </div>

          <div className="bg-[#0e131d] p-3.5 rounded-xl border border-slate-800/80 flex flex-col justify-between">
            <span className="text-[11px] text-slate-400">Gain Potentiel en Rebond Sommet</span>
            <div className="text-base font-bold font-mono text-emerald-400 mt-1">
              +${((swapSimAmount * Math.abs(synthetic30dStats.dropFromHighPct)) / 100).toFixed(2)} USD
            </div>
            <span className="text-[10px] text-emerald-400/80 mt-1">
              Sur {swapSimAmount}$ investis au ratio actuel
            </span>
          </div>
        </div>
      </div>

      {/* 4. THE 15 PRE-CONFIGURED STRATEGIC PAIRS GALLERY */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Compass className="w-5 h-5 text-indigo-400" />
              <h3 className="text-base font-bold text-white tracking-tight m-0">
                Galerie Complète des 15 Paires Synthétiques
              </h3>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                15 Paires Uniques
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Cliquez sur n'importe quelle paire pour l'afficher instantanément dans la charte ci-dessus.
            </p>
          </div>

          {/* Category Filter Tabs */}
          <div className="flex items-center gap-1 bg-[#0e131d] p-1 rounded-2xl border border-slate-800 overflow-x-auto">
            <button
              onClick={() => setGalleryCategory('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                galleryCategory === 'all'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Toutes (15)
            </button>
            <button
              onClick={() => setGalleryCategory('vs-sol')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                galleryCategory === 'vs-sol'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ⚔️ vs SOL (5)
            </button>
            <button
              onClick={() => setGalleryCategory('vs-hype')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                galleryCategory === 'vs-hype'
                  ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ⚡ vs HYPE (4)
            </button>
            <button
              onClick={() => setGalleryCategory('vs-sui')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                galleryCategory === 'vs-sui'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🚀 vs SUI (3)
            </button>
            <button
              onClick={() => setGalleryCategory('cross-alts')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                galleryCategory === 'cross-alts'
                  ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              💎 Cross-Alts (3)
            </button>
          </div>
        </div>

        {/* 15 Pairs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
          {filteredPairs.map((pair) => {
            const isSelected =
              activePair.baseToken.id === pair.baseToken.id &&
              activePair.quoteToken.id === pair.quoteToken.id;

            const tA = tickers[pair.baseToken.symbol];
            const tB = tickers[pair.quoteToken.symbol];
            const synTicker = calculateSyntheticTicker(tA, tB);
            const pPrec = getDynamicPrecision(synTicker.ratio);

            const isPos = synTicker.change24hPercent >= 0;

            return (
              <div
                key={pair.id}
                onClick={() => handleSelectPair(pair)}
                className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between relative group ${
                  isSelected
                    ? 'bg-gradient-to-b from-[#131b2e] to-[#0c1222] border-indigo-500 ring-2 ring-indigo-500/30 shadow-xl'
                    : 'bg-[#0d121c] border-slate-800 hover:border-slate-700 hover:bg-[#111726]'
                }`}
              >
                {isSelected && (
                  <span className="absolute top-2.5 right-2.5 flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px]">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </span>
                )}

                {/* Top header of card */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    {/* Double logo badge */}
                    <div className="flex items-center -space-x-1.5">
                      <div
                        className={`w-6 h-6 rounded-lg flex items-center justify-center text-white font-black text-[9px] shadow-sm bg-gradient-to-br ${pair.baseToken.accentGradient} border border-slate-900`}
                      >
                        {pair.baseToken.baseAsset.slice(0, 2)}
                      </div>
                      <div
                        className={`w-6 h-6 rounded-lg flex items-center justify-center text-white font-black text-[9px] shadow-sm bg-gradient-to-br ${pair.quoteToken.accentGradient} border border-slate-900`}
                      >
                        {pair.quoteToken.baseAsset.slice(0, 2)}
                      </div>
                    </div>
                    <div>
                      <div className="font-bold text-sm text-white flex items-center gap-1">
                        <span>{pair.symbol}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 block line-clamp-1">
                        {pair.narrative}
                      </span>
                    </div>
                  </div>

                  {/* Price & 24h % */}
                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-lg font-black font-mono text-white">
                      {synTicker.ratio < 1
                        ? synTicker.ratio.toFixed(pPrec)
                        : synTicker.ratio.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: pPrec,
                          })}
                    </span>
                    <span
                      className={`text-xs font-bold font-mono px-1.5 py-0.5 rounded ${
                        isPos
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-rose-500/20 text-rose-400'
                      }`}
                    >
                      {isPos ? '+' : ''}
                      {synTicker.change24hPercent.toFixed(2)}%
                    </span>
                  </div>
                </div>

                {/* Bottom Leader Pill */}
                <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">Leader:</span>
                  <span
                    className={`font-semibold ${
                      synTicker.leader === 'base'
                        ? 'text-emerald-400'
                        : synTicker.leader === 'quote'
                        ? 'text-rose-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {synTicker.leader === 'base'
                      ? `${pair.baseToken.baseAsset} (+${synTicker.leaderStrength.toFixed(1)}%)`
                      : synTicker.leader === 'quote'
                      ? `${pair.quoteToken.baseAsset} (+${synTicker.leaderStrength.toFixed(1)}%)`
                      : 'Neutre'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. 6x6 RELATIVE STRENGTH MATRIX (HEATMAP SPREAD) */}
      <div className="bg-[#0b0e14] border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <h4 className="text-sm font-bold text-white m-0">
            Matrice de Force Relative 6x6 (Écart de Performance 24h)
          </h4>
          <span className="text-[10px] text-slate-400">
            Ligne vs Colonne : Vert = La ligne bat la colonne • Rouge = La colonne bat la ligne
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-center text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                <th className="py-2.5 px-3 text-left">Base \ Quote</th>
                {CROSS_TOKENS.map((t) => (
                  <th key={t.id} className="py-2.5 px-3 font-bold text-white">
                    {t.baseAsset}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CROSS_TOKENS.map((rowToken) => {
                const tickRow = tickers[rowToken.symbol];

                return (
                  <tr key={rowToken.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 text-left font-bold text-white flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: rowToken.color }}
                      />
                      <span>{rowToken.baseAsset}</span>
                    </td>
                    {CROSS_TOKENS.map((colToken) => {
                      if (rowToken.id === colToken.id) {
                        return (
                          <td key={colToken.id} className="py-2.5 px-3 text-slate-600 font-bold">
                            —
                          </td>
                        );
                      }

                      const tickCol = tickers[colToken.symbol];
                      const syn = calculateSyntheticTicker(tickRow, tickCol);
                      const spread = syn.change24hPercent;
                      const isPos = spread >= 0;

                      return (
                        <td
                          key={colToken.id}
                          onClick={() => {
                            setBaseTokenId(rowToken.id);
                            setQuoteTokenId(colToken.id);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className={`py-2.5 px-3 font-bold cursor-pointer transition hover:scale-105 ${
                            isPos
                              ? 'text-emerald-400 bg-emerald-500/10'
                              : 'text-rose-400 bg-rose-500/10'
                          }`}
                          title={`Cliquez pour charger la paire ${rowToken.baseAsset}/${colToken.baseAsset}`}
                        >
                          {isPos ? '+' : ''}
                          {spread.toFixed(1)}%
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
