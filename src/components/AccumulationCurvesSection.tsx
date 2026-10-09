import React from 'react';
import type { TokenConfig } from '../types/crypto';
import type { SimpleTransaction } from './PortfolioDcaPage';
import { Layers, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface TokenAccumulationData {
  token: TokenConfig;
  entries: SimpleTransaction[];
  currentUnits: number;
  totalBoughtUnits: number;
  totalSoldUnits: number;
  initialUnits: number;
  unitsGrowthPct: number;
  historyPoints: { timestamp: number; units: number; type: 'buy' | 'sell' }[];
}

interface AccumulationCurvesSectionProps {
  tokensData: TokenAccumulationData[];
}

export const AccumulationCurvesSection: React.FC<AccumulationCurvesSectionProps> = ({ tokensData }) => {
  return (
    <div className="bg-[#0e131d] border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>📈 Suivi d'Accumulation (Évolution des Unités)</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-mono font-medium">
                Option B
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Kol courbe kat-werrik kifach <strong>3adad l-7abbat (Coins)</strong> ghadi w kay-kber m3a kol achat ↗️ wla kay-hbet chwiya mnin kat-shavi rba7 ↘️.
            </p>
          </div>
        </div>
      </div>

      {/* Grid of Mini Curves */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {tokensData.map((data) => {
          const { token, entries, currentUnits, totalBoughtUnits, totalSoldUnits, initialUnits, unitsGrowthPct, historyPoints } = data;
          const hasEntries = entries.length > 0;
          const isGrowthPositive = unitsGrowthPct >= 0;

          // Compute SVG dimensions & path
          const svgWidth = 260;
          const svgHeight = 65;
          const padY = 8;
          const padX = 6;

          let pathD = '';
          let areaD = '';
          let points: { x: number; y: number; units: number; type: 'buy' | 'sell' }[] = [];

          if (historyPoints.length >= 1) {
            const minU = Math.min(...historyPoints.map((p) => p.units));
            const maxU = Math.max(...historyPoints.map((p) => p.units));
            const rangeU = maxU - minU === 0 ? 1 : maxU - minU;

            points = historyPoints.map((pt, index) => {
              const x = historyPoints.length === 1
                ? svgWidth / 2
                : padX + (index / (historyPoints.length - 1)) * (svgWidth - padX * 2);
              const normalized = (pt.units - minU) / rangeU;
              // invert Y: higher units = lower y coord (towards top of SVG)
              const y = svgHeight - padY - normalized * (svgHeight - padY * 2);
              return { x, y, units: pt.units, type: pt.type };
            });

            if (historyPoints.length === 1) {
              const singleY = points[0].y;
              pathD = `M ${padX} ${singleY} L ${svgWidth - padX} ${singleY}`;
              areaD = `M ${padX} ${singleY} L ${svgWidth - padX} ${singleY} L ${svgWidth - padX} ${svgHeight} L ${padX} ${svgHeight} Z`;
            } else {
              // Construct Step-like or Smooth path
              pathD = `M ${points[0].x} ${points[0].y}`;
              for (let i = 1; i < points.length; i++) {
                // Step path gives exact visual feedback of buys & sells
                const prev = points[i - 1];
                const curr = points[i];
                // Smooth bezier or clean step
                const midX = (prev.x + curr.x) / 2;
                pathD += ` C ${midX} ${prev.y}, ${midX} ${curr.y}, ${curr.x} ${curr.y}`;
              }
              const lastPt = points[points.length - 1];
              const firstPt = points[0];
              areaD = `${pathD} L ${lastPt.x} ${svgHeight} L ${firstPt.x} ${svgHeight} Z`;
            }
          }

          const strokeColor = !hasEntries
            ? '#475569'
            : isGrowthPositive
            ? '#10b981'
            : '#f43f5e';

          const gradientId = `grad-${token.id}-${Math.abs(unitsGrowthPct).toFixed(0)}`;

          return (
            <div
              key={token.id}
              className={`bg-[#090d14] border rounded-xl p-3.5 space-y-2.5 transition flex flex-col justify-between ${
                hasEntries
                  ? isGrowthPositive
                    ? 'border-emerald-500/30 hover:border-emerald-500/50'
                    : 'border-rose-500/30 hover:border-rose-500/50'
                  : 'border-slate-800/80 opacity-75'
              }`}
            >
              {/* Card Top: Token Identity + Units Total + Growth Badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-[11px] bg-gradient-to-br ${token.accentGradient || 'from-indigo-500 to-purple-600'}`}>
                    {token.baseAsset.slice(0, 3)}
                  </div>
                  <div>
                    <span className="font-bold text-white text-sm block leading-none">{token.baseAsset}</span>
                    <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                      {hasEntries ? `${currentUnits < 1 ? currentUnits.toFixed(4) : currentUnits.toFixed(2)} jetons` : '0 jeton'}
                    </span>
                  </div>
                </div>

                {hasEntries ? (
                  <div className={`px-2 py-0.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1 ${
                    isGrowthPositive
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                  }`}>
                    {isGrowthPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    <span>{isGrowthPositive ? '+' : ''}{unitsGrowthPct.toFixed(1)}%</span>
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-500 font-mono italic">
                    Khawi
                  </span>
                )}
              </div>

              {/* Sparkline Canvas / Chart Area */}
              <div className="relative bg-[#0d121c] border border-slate-800/70 rounded-lg p-1.5 overflow-hidden">
                {hasEntries && points.length > 0 ? (
                  <>
                    <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-14 overflow-visible">
                      <defs>
                        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.35" />
                          <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Area Fill */}
                      <path d={areaD} fill={`url(#${gradientId})`} />

                      {/* Line Stroke */}
                      <path
                        d={pathD}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Transaction Dots */}
                      {points.map((pt, idx) => (
                        <circle
                          key={idx}
                          cx={pt.x}
                          cy={pt.y}
                          r={idx === points.length - 1 ? 4 : 2.5}
                          fill={pt.type === 'buy' ? '#10b981' : '#f43f5e'}
                          stroke="#0e131d"
                          strokeWidth="1.5"
                        />
                      ))}
                    </svg>

                    {/* Start vs Current Markers */}
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-1 px-1">
                      <span>1er: {initialUnits < 1 ? initialUnits.toFixed(3) : initialUnits.toFixed(1)}</span>
                      <span className="text-white font-bold">Db: {currentUnits < 1 ? currentUnits.toFixed(3) : currentUnits.toFixed(2)}</span>
                    </div>
                  </>
                ) : (
                  <div className="h-16 flex flex-col items-center justify-center text-center p-2 text-slate-500">
                    <span className="text-[11px] font-mono">Ma zedti 7ta achat</span>
                    <span className="text-[9px] text-slate-600">Zid chira bach tban la courbe hna</span>
                  </div>
                )}
              </div>

              {/* Bottom Quick Breakdown */}
              {hasEntries && (
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 border-t border-slate-800/50 pt-1.5 px-0.5">
                  <span className="text-emerald-400/90">
                    Achat: +{totalBoughtUnits < 1 ? totalBoughtUnits.toFixed(3) : totalBoughtUnits.toFixed(1)}
                  </span>
                  {totalSoldUnits > 0 ? (
                    <span className="text-rose-400/90">
                      Vendu: -{totalSoldUnits < 1 ? totalSoldUnits.toFixed(3) : totalSoldUnits.toFixed(1)}
                    </span>
                  ) : (
                    <span className="text-slate-500">0 vente</span>
                  )}
                  <span className="text-indigo-300 font-semibold">
                    {entries.length} tx
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
