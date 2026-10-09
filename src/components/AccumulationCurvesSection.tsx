import React from 'react';
import type { TokenConfig } from '../types/crypto';
import type { SimpleTransaction } from './PortfolioDcaPage';

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

const fmtUnits = (u: number) => (u === 0 ? '0' : u < 1 ? u.toFixed(4) : u < 1000 ? u.toFixed(2) : u.toFixed(0));

export const AccumulationCurvesSection: React.FC<AccumulationCurvesSectionProps> = ({ tokensData }) => {
  return (
    <section className="rounded-lg border border-white/[0.06] bg-[#0f1217]">
      <div className="flex items-baseline justify-between px-5 py-4 border-b border-white/[0.06]">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100 tracking-tight">Accumulation des unités</h3>
          <p className="text-xs text-zinc-500 mt-0.5">Évolution du nombre de jetons détenus, transaction par transaction.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/[0.06] rounded-b-lg overflow-hidden">
        {tokensData.map((data) => {
          const { token, entries, currentUnits, initialUnits, unitsGrowthPct, historyPoints } = data;
          const hasEntries = entries.length > 0;
          const positive = unitsGrowthPct >= 0;

          const W = 240;
          const H = 56;
          const PAD = 4;
          let pathD = '';
          let areaD = '';
          let last: { x: number; y: number } | null = null;

          if (historyPoints.length > 0) {
            const vals = historyPoints.map((p) => p.units);
            const min = Math.min(...vals);
            const max = Math.max(...vals);
            const range = max - min || 1;
            const pts = historyPoints.map((p, i) => ({
              x: historyPoints.length === 1 ? W - PAD : PAD + (i / (historyPoints.length - 1)) * (W - PAD * 2),
              y: H - PAD - ((p.units - min) / range) * (H - PAD * 2),
            }));

            if (pts.length === 1) {
              pathD = `M ${PAD} ${pts[0].y} L ${W - PAD} ${pts[0].y}`;
            } else {
              // Step chart: units change discretely at each transaction
              pathD = `M ${pts[0].x} ${pts[0].y}`;
              for (let i = 1; i < pts.length; i++) {
                pathD += ` H ${pts[i].x} V ${pts[i].y}`;
              }
            }
            const firstX = pts.length === 1 ? PAD : pts[0].x;
            areaD = `${pathD} L ${W - PAD} ${H} L ${firstX} ${H} Z`;
            last = pts[pts.length - 1];
          }

          return (
            <div
              key={token.id}
              className="px-5 py-4 bg-[#0f1217]"
            >
              <div className="flex items-baseline justify-between">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-zinc-100">{token.baseAsset}</span>
                  <span className="text-xs text-zinc-500 tabular-nums">{fmtUnits(currentUnits)} unités</span>
                </div>
                {hasEntries && (
                  <span className={`text-xs font-medium tabular-nums ${positive ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {positive ? '+' : ''}{unitsGrowthPct.toFixed(1)}%
                  </span>
                )}
              </div>

              <div className="mt-3 h-14">
                {hasEntries && last ? (
                  <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-full">
                    <path d={areaD} fill="rgba(255,255,255,0.03)" />
                    <path d={pathD} fill="none" stroke="#a1a1aa" strokeWidth="1.25" vectorEffect="non-scaling-stroke" />
                    <circle cx={last.x} cy={last.y} r="2.5" fill="#e4e4e7" />
                  </svg>
                ) : (
                  <div className="h-full flex items-center justify-center border border-dashed border-white/[0.06] rounded text-[11px] text-zinc-600">
                    Aucune transaction
                  </div>
                )}
              </div>

              {hasEntries && (
                <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500 tabular-nums">
                  <span>Initial {fmtUnits(initialUnits)}</span>
                  <span>{entries.length} tx</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
