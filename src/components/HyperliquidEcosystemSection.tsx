import React, { useState, useMemo } from 'react';
import type { TokenConfig, TickerData, Stats30d } from '../types/crypto';
import {
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Maximize2,
  TrendingUp,
  Flame,
  Layers,
  Repeat,
  Sparkles,
  Zap,
} from 'lucide-react';

interface HyperliquidEcosystemSectionProps {
  tokens: TokenConfig[];
  tickers: Record<string, TickerData>;
  stats30dMap?: Record<string, Stats30d>;
  onSelectToken: (token: TokenConfig) => void;
}

export const HyperliquidEcosystemSection: React.FC<HyperliquidEcosystemSectionProps> = ({
  tokens,
  tickers,
  stats30dMap = {},
  onSelectToken,
}) => {
  const [selectedSubTab, setSelectedSubTab] = useState<'cards' | 'rotation'>('cards');

  // Filter only Hyperliquid ecosystem tokens
  const hyperTokens = useMemo(() => {
    return tokens.filter((t) => t.category === 'hyperliquid');
  }, [tokens]);

  // HYPE base ticker for beta calculations
  const hypeTicker = tickers['HYPEUSDT'];
  const hype24hChange = hypeTicker?.priceChangePercent ?? 0;

  // Aggregate stats across the Hyperliquid tokens
  const aggregateStats = useMemo(() => {
    let totalQuoteVolume = 0;
    let topGainer: { token: TokenConfig; change: number } | null = null;
    let deepestDip: { token: TokenConfig; drop: number } | null = null;

    hyperTokens.forEach((token) => {
      const ticker = tickers[token.symbol];
      const stat = stats30dMap[token.symbol];

      if (ticker) {
        totalQuoteVolume += ticker.quoteVolume || 0;
        if (!topGainer || ticker.priceChangePercent > topGainer.change) {
          topGainer = { token, change: ticker.priceChangePercent };
        }
      }

      if (stat && stat.dropFromHighPct !== undefined) {
        if (!deepestDip || stat.dropFromHighPct < deepestDip.drop) {
          deepestDip = { token, drop: stat.dropFromHighPct };
        }
      }
    });

    return { totalQuoteVolume, topGainer, deepestDip };
  }, [hyperTokens, tickers, stats30dMap]);

  // Rotation pair inside Hyperliquid ecosystem
  const rotationOpportunity = useMemo(() => {
    if (hyperTokens.length < 2) return null;

    let highest24hToken: TokenConfig | null = null;
    let highest24hVal = -Infinity;

    let lowest30dToken: TokenConfig | null = null;
    let lowest30dVal = Infinity;

    hyperTokens.forEach((t) => {
      const tick = tickers[t.symbol];
      const stat = stats30dMap[t.symbol];

      if (tick && tick.priceChangePercent > highest24hVal) {
        highest24hVal = tick.priceChangePercent;
        highest24hToken = t;
      }

      if (stat && stat.dropFromHighPct !== undefined && stat.dropFromHighPct < lowest30dVal) {
        lowest30dVal = stat.dropFromHighPct;
        lowest30dToken = t;
      }
    });

    if (!highest24hToken || !lowest30dToken || highest24hToken === lowest30dToken) {
      return null;
    }

    const statTarget = stats30dMap[(lowest30dToken as TokenConfig).symbol];
    const targetPrice = tickers[(lowest30dToken as TokenConfig).symbol]?.lastPrice || 1;
    const targetHigh = statTarget?.high30d || targetPrice;
    const reboundPotentialPct = targetPrice > 0 ? ((targetHigh - targetPrice) / targetPrice) * 100 : 0;

    return {
      sourceToken: highest24hToken,
      source24h: highest24hVal,
      targetToken: lowest30dToken,
      targetDrop30d: lowest30dVal,
      reboundPotentialPct,
    };
  }, [hyperTokens, tickers, stats30dMap]);

  return (
    <section className="bg-gradient-to-b from-[#091118] via-[#090d14] to-[#0a1016] border-b border-slate-800/80 px-4 lg:px-6 py-6">
      <div className="max-w-[1920px] mx-auto space-y-5">
        {/* Header Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-2xl bg-gradient-to-r from-teal-950/40 via-cyan-950/30 to-indigo-950/40 border border-teal-500/30 backdrop-blur-md">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-teal-500 via-cyan-400 to-indigo-500 p-0.5 shadow-lg shadow-teal-500/25">
              <div className="w-full h-full bg-[#0a1016] rounded-[10px] flex items-center justify-center">
                <Activity className="w-6 h-6 text-teal-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2 m-0">
                  Écosystème <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 via-cyan-300 to-indigo-300">Hyperliquid Hub</span>
                </h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  {hyperTokens.length} Tokens
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Surveillance en direct des piliers HyperCore & HyperEVM : <strong className="text-slate-200">HYPE</strong> (L1 Gas), <strong className="text-slate-200">PURR</strong> (Top Meme), <strong className="text-slate-200">HFUN</strong> (Launchpad), <strong className="text-slate-200">HYPER</strong> (Bridge), <strong className="text-slate-200">JEFF</strong> (DeFi)
              </p>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex flex-wrap items-center gap-3">
            {/* HYPE Benchmark Price */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl px-3.5 py-2">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">HYPE Benchmark</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm font-bold font-mono text-teal-400">
                  ${hypeTicker ? hypeTicker.lastPrice.toFixed(2) : '---'}
                </span>
                <span
                  className={`text-xs font-mono font-medium flex items-center ${
                    hype24hChange >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {hype24hChange >= 0 ? '+' : ''}
                  {hype24hChange.toFixed(2)}%
                </span>
              </div>
            </div>

            {/* Total 24h Volume */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl px-3.5 py-2">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Volume Écosystème 24h</div>
              <div className="text-sm font-bold font-mono text-cyan-300 mt-0.5">
                ${aggregateStats.totalQuoteVolume > 0
                  ? (aggregateStats.totalQuoteVolume / 1_000_000).toFixed(1) + 'M USD'
                  : '---'}
              </div>
            </div>

            {/* Top Gainer */}
            {aggregateStats.topGainer && (
              <div className="bg-slate-900/80 border border-teal-500/30 rounded-xl px-3.5 py-2">
                <div className="text-[10px] text-teal-400 uppercase font-semibold flex items-center gap-1">
                  <Flame className="w-3 h-3" />
                  Top Gainer 24h
                </div>
                <div className="text-sm font-bold font-mono text-white mt-0.5">
                  {(aggregateStats.topGainer as any).token.baseAsset}{' '}
                  <span className="text-emerald-400">
                    +{(aggregateStats.topGainer as any).change.toFixed(2)}%
                  </span>
                </div>
              </div>
            )}

            {/* View subtabs */}
            <div className="flex items-center bg-slate-900/90 border border-slate-800 rounded-xl p-1 ml-auto lg:ml-0">
              <button
                onClick={() => setSelectedSubTab('cards')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  selectedSubTab === 'cards'
                    ? 'bg-teal-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Cartes Détaillées</span>
              </button>
              <button
                onClick={() => setSelectedSubTab('rotation')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  selectedSubTab === 'rotation'
                    ? 'bg-teal-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Repeat className="w-3.5 h-3.5" />
                <span>Rotation Hyperliquid</span>
              </button>
            </div>
          </div>
        </div>

        {/* 5 Token Cards Grid */}
        {selectedSubTab === 'cards' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {hyperTokens.map((token) => {
              const ticker = tickers[token.symbol];
              const stat30d = stats30dMap[token.symbol];
              const priceChange = ticker?.priceChangePercent ?? 0;
              const isPositive = priceChange >= 0;

              // Format price
              const priceFormatted = ticker
                ? ticker.lastPrice < 1
                  ? ticker.lastPrice.toFixed(token.precision)
                  : ticker.lastPrice.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: token.precision,
                    })
                : '---';

              // 24h High/Low range position
              const low = ticker?.lowPrice || 0;
              const high = ticker?.highPrice || 0;
              const current = ticker?.lastPrice || 0;
              const rangePct = high > low ? Math.min(100, Math.max(0, ((current - low) / (high - low)) * 100)) : 50;

              // HYPE-Beta calculation: Delta vs HYPE 24h
              const hypeBetaDelta = priceChange - hype24hChange;
              const isOutperformingHype = hypeBetaDelta >= 0;

              // 30d Drawdown
              const drop30d = stat30d?.dropFromHighPct;

              return (
                <div
                  key={token.id}
                  className="bg-[#0e131d] border border-slate-800/90 hover:border-teal-500/50 rounded-2xl p-4.5 flex flex-col justify-between transition-all duration-200 hover:shadow-xl hover:shadow-teal-950/20 group relative overflow-hidden"
                >
                  {/* Top glowing accent line */}
                  <div
                    className="absolute top-0 left-0 right-0 h-1"
                    style={{ backgroundColor: token.color }}
                  />

                  <div>
                    {/* Token Header */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: token.color }}
                          />
                          <h3 className="font-bold text-base text-white tracking-tight m-0">
                            {token.name}
                          </h3>
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                          {token.symbol}
                        </div>
                      </div>

                      {/* Ecosystem Role Badge */}
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-300 border border-teal-500/20 text-right leading-tight max-w-[120px]">
                        {token.ecosystemRole || 'Hyperliquid L1'}
                      </span>
                    </div>

                    {/* Price and 24h Change */}
                    <div className="flex items-baseline justify-between mb-3 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/60">
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Prix Direct</div>
                        <div className="text-xl font-black font-mono tracking-tight text-white mt-0.5">
                          ${priceFormatted}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">24h Change</div>
                        <div
                          className={`text-xs font-mono font-bold flex items-center justify-end gap-0.5 mt-0.5 ${
                            isPositive ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isPositive ? (
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowDownRight className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {isPositive ? '+' : ''}
                            {priceChange.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 24h Range Bar */}
                    <div className="mb-3">
                      <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1">
                        <span>Bas: ${low < 1 ? low.toFixed(token.precision) : low.toFixed(2)}</span>
                        <span>Haut: ${high < 1 ? high.toFixed(token.precision) : high.toFixed(2)}</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
                        <div
                          className="h-full bg-gradient-to-r from-teal-400 via-cyan-500 to-indigo-500 rounded-full transition-all duration-300"
                          style={{ width: `${rangePct}%` }}
                        />
                      </div>
                    </div>

                    {/* Key Strategic Metrics: Drawdown 30J & HYPE-Beta */}
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {/* Écart Sommet 30J */}
                      <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                        <div className="text-[10px] text-slate-400 font-medium">Écart Sommet 30J</div>
                        <div
                          className={`text-xs font-mono font-bold mt-0.5 ${
                            drop30d !== undefined && drop30d <= -20
                              ? 'text-amber-400'
                              : drop30d !== undefined && drop30d <= -35
                              ? 'text-rose-400'
                              : 'text-slate-300'
                          }`}
                        >
                          {drop30d !== undefined ? `${drop30d.toFixed(1)}%` : '---'}
                        </div>
                      </div>

                      {/* HYPE-Beta (Delta vs HYPE) */}
                      <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                        <div className="text-[10px] text-slate-400 font-medium">Δ vs HYPE (24h)</div>
                        <div
                          className={`text-xs font-mono font-bold mt-0.5 flex items-center gap-0.5 ${
                            isOutperformingHype ? 'text-teal-300' : 'text-slate-400'
                          }`}
                        >
                          {token.id === 'hype' ? (
                            <span className="text-slate-400 font-normal">Base 1.00x</span>
                          ) : (
                            <>
                              {isOutperformingHype ? '+' : ''}
                              {hypeBetaDelta.toFixed(2)}%
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action button */}
                  <button
                    onClick={() => onSelectToken(token)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-gradient-to-r hover:from-teal-600 hover:to-cyan-600 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700/60 hover:border-teal-500/50 transition cursor-pointer"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Focus Chart & Carnet</span>
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          /* Hyperliquid Rotation & Arbitrage Scanner View */
          <div className="bg-[#0e131d] border border-teal-500/30 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h3 className="text-base font-bold text-white m-0">
                Opportunité de Rotation Interne Écosystème Hyperliquid
              </h3>
            </div>

            {rotationOpportunity ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                {/* Source: Top Pumper */}
                <div className="flex items-center gap-3 p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">1. Vendre le Top Pump</div>
                    <div className="text-sm font-bold text-white">
                      {(rotationOpportunity as any).sourceToken.name} ({(rotationOpportunity as any).sourceToken.baseAsset})
                    </div>
                    <div className="text-xs font-mono font-bold text-emerald-400">
                      +{(rotationOpportunity as any).source24h.toFixed(2)}% (24h)
                    </div>
                  </div>
                </div>

                {/* Arrow / Ratio */}
                <div className="flex flex-col items-center justify-center text-center px-2">
                  <div className="p-2 rounded-full bg-teal-500/20 border border-teal-500/40 text-teal-300">
                    <Repeat className="w-5 h-5 animate-pulse" />
                  </div>
                  <div className="text-[11px] font-bold text-teal-300 mt-1">
                    Rotation Stratégique
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Prendre profit sur le pump & accumuler le dip
                  </div>
                </div>

                {/* Target: Deepest 30d Dip */}
                <div className="flex items-center gap-3 p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                    <ArrowDownRight className="w-5 h-5 text-rose-400" />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">2. Acheter le Meilleur Dip</div>
                    <div className="text-sm font-bold text-white">
                      {(rotationOpportunity as any).targetToken.name} ({(rotationOpportunity as any).targetToken.baseAsset})
                    </div>
                    <div className="text-xs font-mono font-bold text-rose-400">
                      {(rotationOpportunity as any).targetDrop30d.toFixed(1)}% vs Sommet 30J
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-slate-400 text-xs font-mono">
                Calcul des ratios de rotation Hyperliquid en cours...
              </div>
            )}

            {/* Quick explanation */}
            <div className="text-xs text-slate-400 bg-teal-950/20 border border-teal-500/20 rounded-xl p-3 flex items-start gap-2.5">
              <Zap className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Dynamique HyperCore & HyperEVM :</strong> Sur la blockchain Hyperliquid, la liquidité tourne en continu entre <strong>HYPE</strong> (L1 King), <strong>PURR</strong> (Mascot Meme), <strong>HFUN</strong> (Launchpad memecoins), <strong>HYPER</strong> (Bridge interop) et <strong>JEFF</strong> (DeFi). Tourner ses profits vers les tokens en correction maximale permet de maximiser le rebond lors des vagues de pumps!
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
