import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { TickerData, CandleData } from '../types/crypto';
import { CROSS_TOKENS } from '../config/crossPairs';
import {
  Calculator,
  RotateCcw,
  Sparkles,
  Zap,
  ArrowRight,
  DollarSign,
  History,
  Layers,
  Award,
} from 'lucide-react';

interface BasketRotationSimulatorProps {
  tickers: Record<string, TickerData>;
  multiCandles: Record<string, CandleData[]>;
}

export interface SimulatedSwap {
  id: string;
  timestamp: number;
  timeLabel: string;
  fromTokenId: string;
  fromSymbol: string;
  toTokenId: string;
  toSymbol: string;
  usdAmount: number;
  fromUnitsSold: number;
  toUnitsBought: number;
  spreadPct: number;
  gainPct: number;
}

export const BasketRotationSimulator: React.FC<BasketRotationSimulatorProps> = ({
  tickers,
  multiCandles,
}) => {
  // 1. Initial Investment Settings
  const [initialPerToken, setInitialPerToken] = useState<number>(10); // $10 per token
  const [rebalanceThresholdPct, setRebalanceThresholdPct] = useState<number>(5); // Trigger at +5% spread
  const [rebalancePortionPct, setRebalancePortionPct] = useState<number>(20); // Swap 20% of the leader

  // 2. State of user executed / live swaps
  const [executedSwaps, setExecutedSwaps] = useState<SimulatedSwap[]>([]);

  // 3. Mode: Live Interactive vs Historical Backtest
  const [activeTab, setActiveTab] = useState<'live' | 'backtest'>('live');

  // Baseline prices map (Initial price when simulator starts or lowest candle)
  const [baselinePrices, setBaselinePrices] = useState<Record<string, number>>({});

  useEffect(() => {
    // Set initial baseline prices from live tickers if not already set
    const initial: Record<string, number> = {};
    let hasAny = false;

    CROSS_TOKENS.forEach((t) => {
      const price = tickers[t.symbol]?.lastPrice;
      if (price && price > 0) {
        initial[t.id] = price;
        hasAny = true;
      }
    });

    if (hasAny && Object.keys(baselinePrices).length === 0) {
      setBaselinePrices(initial);
    }
  }, [tickers, baselinePrices]);

  // Current live prices map
  const currentPrices = useMemo(() => {
    const map: Record<string, number> = {};
    CROSS_TOKENS.forEach((t) => {
      const live = tickers[t.symbol]?.lastPrice;
      map[t.id] = live && live > 0 ? live : (baselinePrices[t.id] || 1);
    });
    return map;
  }, [tickers, baselinePrices]);

  // Reset simulator to initial $10 state
  const handleReset = useCallback(() => {
    setExecutedSwaps([]);
    const freshPrices: Record<string, number> = {};
    CROSS_TOKENS.forEach((t) => {
      const live = tickers[t.symbol]?.lastPrice;
      if (live && live > 0) freshPrices[t.id] = live;
    });
    setBaselinePrices(freshPrices);
  }, [tickers]);

  // Calculate current holdings for each token taking executed swaps into account
  const currentHoldings = useMemo(() => {
    // Initial units based on baseline price
    const unitsMap: Record<string, number> = {};

    CROSS_TOKENS.forEach((t) => {
      const basePx = baselinePrices[t.id] || currentPrices[t.id] || 1;
      unitsMap[t.id] = initialPerToken / basePx;
    });

    // Apply all executed swaps
    executedSwaps.forEach((swap) => {
      if (unitsMap[swap.fromTokenId] !== undefined) {
        unitsMap[swap.fromTokenId] = Math.max(0, unitsMap[swap.fromTokenId] - swap.fromUnitsSold);
      }
      if (unitsMap[swap.toTokenId] !== undefined) {
        unitsMap[swap.toTokenId] += swap.toUnitsBought;
      }
    });

    return unitsMap;
  }, [initialPerToken, baselinePrices, currentPrices, executedSwaps]);

  // Performance calculations for both strategies
  const portfolioStats = useMemo(() => {
    const totalInitialInvested = initialPerToken * CROSS_TOKENS.length; // e.g. $10 * 6 = $60

    let holdValueUsd = 0;
    let rotationValueUsd = 0;

    const tokenRows = CROSS_TOKENS.map((t) => {
      const basePx = baselinePrices[t.id] || currentPrices[t.id] || 1;
      const curPx = currentPrices[t.id] || basePx;

      const initialUnits = initialPerToken / basePx;
      const currentUnits = currentHoldings[t.id] || initialUnits;

      const holdUsd = initialUnits * curPx;
      const rotationUsd = currentUnits * curPx;

      holdValueUsd += holdUsd;
      rotationValueUsd += rotationUsd;

      const unitsGrowthPct = initialUnits > 0 ? ((currentUnits - initialUnits) / initialUnits) * 100 : 0;
      const pnlPct = initialPerToken > 0 ? ((rotationUsd - initialPerToken) / initialPerToken) * 100 : 0;

      return {
        token: t,
        initialPrice: basePx,
        currentPrice: curPx,
        initialUnits,
        currentUnits,
        unitsGrowthPct,
        holdUsd,
        rotationUsd,
        pnlPct,
      };
    });

    const holdPnlUsd = holdValueUsd - totalInitialInvested;
    const holdPnlPct = (holdPnlUsd / totalInitialInvested) * 100;

    const rotationPnlUsd = rotationValueUsd - totalInitialInvested;
    const rotationPnlPct = (rotationPnlUsd / totalInitialInvested) * 100;

    const alphaUsd = rotationValueUsd - holdValueUsd;
    const alphaPct = holdValueUsd > 0 ? (alphaUsd / holdValueUsd) * 100 : 0;

    return {
      totalInitialInvested,
      holdValueUsd,
      holdPnlUsd,
      holdPnlPct,
      rotationValueUsd,
      rotationPnlUsd,
      rotationPnlPct,
      alphaUsd,
      alphaPct,
      tokenRows,
    };
  }, [initialPerToken, baselinePrices, currentPrices, currentHoldings]);

  // Identify Best Live Rotation Opportunity right now
  const bestLiveOpportunity = useMemo(() => {
    let topGainer: { token: typeof CROSS_TOKENS[0]; change: number } | null = null;
    let deepestDip: { token: typeof CROSS_TOKENS[0]; change: number } | null = null;

    CROSS_TOKENS.forEach((t) => {
      const tick = tickers[t.symbol];
      const change = tick?.priceChangePercent ?? 0;

      if (!topGainer || change > topGainer.change) {
        topGainer = { token: t, change };
      }
      if (!deepestDip || change < deepestDip.change) {
        deepestDip = { token: t, change };
      }
    });

    if (!topGainer || !deepestDip || (topGainer as any).token.id === (deepestDip as any).token.id) {
      return null;
    }

    const spread = (topGainer as any).change - (deepestDip as any).change;

    return {
      fromToken: (topGainer as any).token,
      fromChange: (topGainer as any).change,
      toToken: (deepestDip as any).token,
      toChange: (deepestDip as any).change,
      spread,
    };
  }, [tickers]);

  // Execute Live Optimal Swap
  const handleExecuteLiveSwap = () => {
    if (!bestLiveOpportunity) return;

    const { fromToken, toToken, spread } = bestLiveOpportunity;
    const fromPx = currentPrices[fromToken.id];
    const toPx = currentPrices[toToken.id];

    if (!fromPx || !toPx) return;

    const fromCurrentUnits = currentHoldings[fromToken.id] || (initialPerToken / fromPx);
    const fromUsdVal = fromCurrentUnits * fromPx;

    // Swap specified portion of the leader
    const swapUsdAmount = (fromUsdVal * rebalancePortionPct) / 100;
    if (swapUsdAmount <= 0.05) return;

    const fromUnitsSold = swapUsdAmount / fromPx;
    const toUnitsBought = swapUsdAmount / toPx;

    const newSwap: SimulatedSwap = {
      id: `swap-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      timeLabel: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      fromTokenId: fromToken.id,
      fromSymbol: fromToken.baseAsset,
      toTokenId: toToken.id,
      toSymbol: toToken.baseAsset,
      usdAmount: swapUsdAmount,
      fromUnitsSold,
      toUnitsBought,
      spreadPct: spread,
      gainPct: spread,
    };

    setExecutedSwaps((prev) => [newSwap, ...prev]);
  };

  // Run Automated Historical Simulation across multiCandles
  const runHistoricalSimulation = () => {
    // Check if we have candles
    const tokenCandles: Record<string, CandleData[]> = {};
    let minLen = Infinity;

    CROSS_TOKENS.forEach((t) => {
      const c = multiCandles[t.symbol] || [];
      if (c.length > 5) {
        tokenCandles[t.id] = c;
        if (c.length < minLen) minLen = c.length;
      }
    });

    if (minLen === Infinity || minLen < 10) {
      alert("Données historiques insuffisantes pour le backtest automatique. Veuillez patienter pendant le chargement des bougies.");
      return;
    }

    // Baseline: first candle close of each token
    const startPrices: Record<string, number> = {};
    const simUnits: Record<string, number> = {};

    CROSS_TOKENS.forEach((t) => {
      const cList = tokenCandles[t.id];
      const startPx = cList && cList.length ? cList[0].close : 1;
      startPrices[t.id] = startPx;
      simUnits[t.id] = initialPerToken / startPx;
    });

    setBaselinePrices(startPrices);

    const generatedSwaps: SimulatedSwap[] = [];
    const lookback = 4; // Lookback 4 candles to calculate local momentum

    // Iterate through time steps
    for (let step = lookback; step < minLen; step += 3) {
      let bestGainerId = '';
      let bestGainerChange = -Infinity;
      let worstDipId = '';
      let worstDipChange = Infinity;

      CROSS_TOKENS.forEach((t) => {
        const cList = tokenCandles[t.id];
        if (cList && cList[step] && cList[step - lookback]) {
          const cur = cList[step].close;
          const prev = cList[step - lookback].close;
          const change = ((cur - prev) / prev) * 100;

          if (change > bestGainerChange) {
            bestGainerChange = change;
            bestGainerId = t.id;
          }
          if (change < worstDipChange) {
            worstDipChange = change;
            worstDipId = t.id;
          }
        }
      });

      const spread = bestGainerChange - worstDipChange;

      // Trigger if spread exceeds user threshold
      if (spread >= rebalanceThresholdPct && bestGainerId && worstDipId && bestGainerId !== worstDipId) {
        const fromToken = CROSS_TOKENS.find((t) => t.id === bestGainerId)!;
        const toToken = CROSS_TOKENS.find((t) => t.id === worstDipId)!;

        const fromPx = tokenCandles[bestGainerId][step].close;
        const toPx = tokenCandles[worstDipId][step].close;

        const fromUnits = simUnits[bestGainerId] || 0;
        const fromValUsd = fromUnits * fromPx;
        const swapUsd = (fromValUsd * rebalancePortionPct) / 100;

        if (swapUsd > 0.1) {
          const soldUnits = swapUsd / fromPx;
          const boughtUnits = swapUsd / toPx;

          simUnits[bestGainerId] -= soldUnits;
          simUnits[worstDipId] += boughtUnits;

          const candleTime = tokenCandles[bestGainerId][step].time;
          const dateObj = new Date(candleTime * 1000);

          generatedSwaps.unshift({
            id: `backtest-${step}-${Date.now()}`,
            timestamp: candleTime * 1000,
            timeLabel: dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            fromTokenId: fromToken.id,
            fromSymbol: fromToken.baseAsset,
            toTokenId: toToken.id,
            toSymbol: toToken.baseAsset,
            usdAmount: swapUsd,
            fromUnitsSold: soldUnits,
            toUnitsBought: boughtUnits,
            spreadPct: spread,
            gainPct: spread,
          });
        }
      }
    }

    setExecutedSwaps(generatedSwaps);
    setActiveTab('backtest');
  };

  return (
    <div className="bg-[#0b0e14] border border-slate-800 rounded-3xl p-5 lg:p-6 space-y-6 shadow-2xl relative overflow-hidden">
      {/* Background glow styling */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-emerald-500 p-0.5 shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-[#0b0e14] rounded-[14px] flex items-center justify-center">
                <Calculator className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white tracking-tight m-0">
                  Simulateur de Portefeuille & Compounding Basket
                </h3>
                <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {initialPerToken}$ / Token Initial
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Stratégie de Compounding: Vendre une part du token gagnant pour racheter le token en dip afin d'accumuler plus de jetons.
              </p>
            </div>
          </div>
        </div>

        {/* Configuration Bar */}
        <div className="flex flex-wrap items-center gap-3 bg-[#0e131d] p-2 rounded-2xl border border-slate-800">
          {/* Initial Capital Selector */}
          <div className="flex items-center gap-1.5 px-2">
            <DollarSign className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-400 font-semibold">Par Token:</span>
            <div className="flex items-center gap-1">
              {[10, 50, 100].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setInitialPerToken(amt)}
                  className={`px-2 py-0.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                    initialPerToken === amt
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ${amt}
                </button>
              ))}
            </div>
          </div>

          <div className="h-6 w-[1px] bg-slate-800 hidden sm:block" />

          {/* Trigger Threshold */}
          <div className="flex items-center gap-1.5 px-2">
            <span className="text-xs text-slate-400 font-semibold">Seuil:</span>
            <select
              value={rebalanceThresholdPct}
              onChange={(e) => setRebalanceThresholdPct(Number(e.target.value))}
              className="bg-[#090d14] text-xs font-mono font-bold text-white border border-slate-700 rounded-lg px-2 py-1 focus:outline-none cursor-pointer"
            >
              <option value={3}>+3% Écart</option>
              <option value={5}>+5% Écart</option>
              <option value={8}>+8% Écart</option>
              <option value={10}>+10% Écart</option>
            </select>
          </div>

          {/* Rebalance Portion */}
          <div className="flex items-center gap-1.5 px-2">
            <span className="text-xs text-slate-400 font-semibold">Part Rebalance:</span>
            <select
              value={rebalancePortionPct}
              onChange={(e) => setRebalancePortionPct(Number(e.target.value))}
              className="bg-[#090d14] text-xs font-mono font-bold text-white border border-slate-700 rounded-lg px-2 py-1 focus:outline-none cursor-pointer"
            >
              <option value={10}>10% du Leader</option>
              <option value={20}>20% du Leader</option>
              <option value={30}>30% du Leader</option>
            </select>
          </div>

          {/* Reset button */}
          <button
            onClick={handleReset}
            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
            title="Réinitialiser le simulateur"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. BIG KPI SUMMARY CARDS: BUY & HOLD vs BASKET ROTATION */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Initial Invested */}
        <div className="bg-[#0e131d] p-4 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Capital Initial Investi</span>
            <span className="text-[10px] font-mono bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">
              6 Tokens × ${initialPerToken}
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-white mt-2">
            ${portfolioStats.totalInitialInvested.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            SOL, SUI, ZEC, MON, HYPE, PENGU
          </div>
        </div>

        {/* Card 2: Passive Buy & Hold */}
        <div className="bg-[#0e131d] p-4 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Stratégie A : Buy & Hold (0 Swap)</span>
            <span className="text-[10px] text-slate-500 font-mono">Garder sans toucher</span>
          </div>
          <div className="text-2xl font-black font-mono text-slate-200 mt-2 flex items-baseline gap-2">
            <span>${portfolioStats.holdValueUsd.toFixed(2)}</span>
            <span
              className={`text-xs font-bold ${
                portfolioStats.holdPnlPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {portfolioStats.holdPnlPct >= 0 ? '+' : ''}
              {portfolioStats.holdPnlPct.toFixed(2)}%
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            PnL Passif : {portfolioStats.holdPnlUsd >= 0 ? '+' : ''}${portfolioStats.holdPnlUsd.toFixed(2)} USD
          </div>
        </div>

        {/* Card 3: Dynamic Rotation Rebalancing */}
        <div className="bg-gradient-to-br from-[#121b2d] to-[#0e1524] p-4 rounded-2xl border border-indigo-500/40 ring-1 ring-indigo-500/30 flex flex-col justify-between relative shadow-lg">
          <div className="flex items-center justify-between text-indigo-300 text-xs font-bold">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Stratégie B : Rotation Dynamique</span>
            </span>
            <span className="text-[10px] font-mono bg-indigo-500/20 px-1.5 py-0.5 rounded text-indigo-300">
              {executedSwaps.length} Swaps
            </span>
          </div>
          <div className="text-2xl lg:text-3xl font-black font-mono text-emerald-400 mt-2 flex items-baseline gap-2">
            <span>${portfolioStats.rotationValueUsd.toFixed(2)}</span>
            <span className="text-xs font-bold text-emerald-400">
              {portfolioStats.rotationPnlPct >= 0 ? '+' : ''}
              {portfolioStats.rotationPnlPct.toFixed(2)}%
            </span>
          </div>
          <div className="text-[11px] text-slate-300 mt-1 font-semibold flex items-center justify-between">
            <span>PnL Total : +${portfolioStats.rotationPnlUsd.toFixed(2)}</span>
            <span className="text-amber-400 font-mono">Compounding Actif</span>
          </div>
        </div>

        {/* Card 4: Alpha / Extra Gain from Swapping */}
        <div className="bg-gradient-to-br from-[#0c221a] to-[#0e171f] p-4 rounded-2xl border border-emerald-500/40 ring-1 ring-emerald-500/30 flex flex-col justify-between shadow-lg">
          <div className="flex items-center justify-between text-emerald-300 text-xs font-bold">
            <span className="flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-emerald-400" />
              <span>Alpha Généré par les Swaps</span>
            </span>
            <span className="text-[10px] uppercase font-bold bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">
              Gain Net
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-emerald-300 mt-2 flex items-baseline gap-2">
            <span>
              {portfolioStats.alphaUsd >= 0 ? '+' : ''}${portfolioStats.alphaUsd.toFixed(2)}
            </span>
            <span className="text-xs font-bold text-emerald-400">
              ({portfolioStats.alphaPct >= 0 ? '+' : ''}{portfolioStats.alphaPct.toFixed(2)}% vs Hold)
            </span>
          </div>
          <div className="text-[11px] text-emerald-400/90 mt-1">
            {portfolioStats.alphaUsd >= 0
              ? `Surperformance de +$${portfolioStats.alphaUsd.toFixed(2)} grâce aux rotations !`
              : 'En attente de rebond des dips accumulés'}
          </div>
        </div>
      </div>

      {/* 3. INTERACTIVE SIMULATOR ACTION BAR */}
      <div className="bg-[#0e131d] p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Best live swap indicator */}
        <div className="flex items-center gap-3">
          {bestLiveOpportunity ? (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <span>Opportunité Live Détectée :</span>
                  <span className="text-emerald-400">{bestLiveOpportunity.fromToken.baseAsset} (+{bestLiveOpportunity.fromChange.toFixed(1)}%)</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-rose-400">{bestLiveOpportunity.toToken.baseAsset} ({bestLiveOpportunity.toChange.toFixed(1)}%)</span>
                  <span className="text-[10px] font-mono bg-indigo-500/20 text-indigo-300 px-1.5 py-0.2 rounded font-bold">
                    Écart : {bestLiveOpportunity.spread.toFixed(1)}%
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Vendre {rebalancePortionPct}% des profits de {bestLiveOpportunity.fromToken.baseAsset} pour accumuler {bestLiveOpportunity.toToken.baseAsset} à rabais.
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400">
              Analyse du marché en cours...
            </div>
          )}
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Live One-Click Swap */}
          <button
            onClick={handleExecuteLiveSwap}
            disabled={!bestLiveOpportunity}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/40 transition cursor-pointer disabled:opacity-50"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Exécuter ce Swap Live</span>
          </button>

          {/* Historical Backtest Simulator */}
          <button
            onClick={runHistoricalSimulation}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-indigo-950/40 transition cursor-pointer"
          >
            <History className="w-3.5 h-3.5" />
            <span>Simuler l'Historique Automatique</span>
          </button>
        </div>
      </div>

      {/* 4. TABLEAU DÉTAILLÉ : UNITÉS DE TOKENS & ACCUMULATION */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            <h4 className="text-sm font-bold text-white tracking-tight m-0">
              Portefeuille Détaillé • Accumulation de Jetons (Token Units Compounding)
            </h4>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {executedSwaps.length > 0 ? (
              <span className="text-emerald-400 font-bold">
                ✓ {executedSwaps.length} rotations appliquées au portefeuille
              </span>
            ) : (
              'Aucun swap exécuté pour le moment (Portefeuille initial)'
            )}
          </span>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-[#0d111a]">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#090d14] text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Token</th>
                <th className="py-3 px-4 text-right">Prix Initial</th>
                <th className="py-3 px-4 text-right">Prix Actuel</th>
                <th className="py-3 px-4 text-right">Jetons Initiaux</th>
                <th className="py-3 px-4 text-right">Jetons Actuels</th>
                <th className="py-3 px-4 text-right bg-indigo-950/20 text-indigo-300">
                  Unités Accumulées (%)
                </th>
                <th className="py-3 px-4 text-right">Valeur Hold ($)</th>
                <th className="py-3 px-4 text-right bg-emerald-950/20 text-emerald-300">
                  Valeur Rotation ($)
                </th>
              </tr>
            </thead>
            <tbody>
              {portfolioStats.tokenRows.map((row) => {
                const isAccumulated = row.unitsGrowthPct > 0;
                const isDecreased = row.unitsGrowthPct < 0;

                return (
                  <tr
                    key={row.token.id}
                    className="border-b border-slate-800/60 hover:bg-slate-800/30 transition"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-[10px] shadow-sm bg-gradient-to-br ${row.token.accentGradient}`}
                        >
                          {row.token.baseAsset.slice(0, 3)}
                        </div>
                        <div>
                          <span className="font-bold text-white text-xs">{row.token.baseAsset}</span>
                          <span className="text-[10px] text-slate-500 block">{row.token.name}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right text-slate-400">
                      ${row.initialPrice < 1 ? row.initialPrice.toFixed(4) : row.initialPrice.toFixed(2)}
                    </td>

                    <td className="py-3 px-4 text-right font-bold text-white">
                      ${row.currentPrice < 1 ? row.currentPrice.toFixed(4) : row.currentPrice.toFixed(2)}
                    </td>

                    <td className="py-3 px-4 text-right text-slate-400">
                      {row.initialUnits < 1 ? row.initialUnits.toFixed(4) : row.initialUnits.toFixed(2)}
                    </td>

                    <td className="py-3 px-4 text-right font-bold text-white">
                      {row.currentUnits < 1 ? row.currentUnits.toFixed(4) : row.currentUnits.toFixed(2)}
                    </td>

                    {/* Units Growth Badge */}
                    <td className="py-3 px-4 text-right font-bold bg-indigo-950/20">
                      {isAccumulated ? (
                        <span className="text-emerald-400 inline-flex items-center gap-0.5">
                          +{row.unitsGrowthPct.toFixed(1)}% 🚀
                        </span>
                      ) : isDecreased ? (
                        <span className="text-amber-400 inline-flex items-center gap-0.5">
                          {row.unitsGrowthPct.toFixed(1)}% (Vendu en profit)
                        </span>
                      ) : (
                        <span className="text-slate-500">0.0%</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right text-slate-400">
                      ${row.holdUsd.toFixed(2)}
                    </td>

                    <td className="py-3 px-4 text-right font-black text-emerald-400 bg-emerald-950/20">
                      ${row.rotationUsd.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. JOURNAL DES SWAPS EXÉCUTÉS */}
      {executedSwaps.length > 0 && (
        <div className="space-y-3 border-t border-slate-800/80 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-400" />
                <h4 className="text-sm font-bold text-white m-0">
                  Journal des Rotations Exécutées ({executedSwaps.length} Swaps)
                </h4>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                activeTab === 'live' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-indigo-500/20 text-indigo-300'
              }`}>
                {activeTab === 'live' ? '● Mode Live' : '● Mode Backtest'}
              </span>
            </div>
            <button
              onClick={() => setExecutedSwaps([])}
              className="text-[11px] text-slate-500 hover:text-slate-300 underline cursor-pointer"
            >
              Effacer le journal
            </button>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {executedSwaps.slice(0, 15).map((swap) => (
              <div
                key={swap.id}
                className="bg-[#0e131d] border border-slate-800/80 p-3 rounded-xl flex flex-wrap items-center justify-between text-xs font-mono gap-2"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-[11px] text-slate-500">{swap.timeLabel}</span>
                  <span className="font-bold text-emerald-400">
                    Vente {swap.fromSymbol} (${swap.usdAmount.toFixed(2)})
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                  <span className="font-bold text-indigo-300">
                    Achat {swap.toSymbol} (+{swap.toUnitsBought < 1 ? swap.toUnitsBought.toFixed(4) : swap.toUnitsBought.toFixed(2)} unités)
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-400">
                    Écart capté: <strong className="text-amber-400">+{swap.spreadPct.toFixed(1)}%</strong>
                  </span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                    ✓ Rebalancé
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
