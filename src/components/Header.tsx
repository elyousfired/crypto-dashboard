import React from 'react';
import type { ViewMode, DashboardPage } from '../types/crypto';
import { RefreshCw, Repeat, Table } from 'lucide-react';

interface HeaderProps {
  page: DashboardPage;
  setPage: (page: DashboardPage) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  onRefresh: () => void;
  binanceConnected: boolean;
  bybitConnected: boolean;
  hyperliquidConnected?: boolean;
  activeExchangeCount: number;
  showTable?: boolean;
  onToggleTable?: () => void;
  showRotation?: boolean;
  onToggleRotation?: () => void;
}

const NAV: { id: DashboardPage; label: string }[] = [
  { id: 'solana', label: 'Solana' },
  { id: 'hyperliquid', label: 'Hyperliquid' },
  { id: 'global', label: 'Global' },
  { id: 'cross-pairs', label: 'Cross-Pairs' },
  { id: 'portfolio', label: 'Portfolio' },
];

const VIEW_MODES: { id: ViewMode; label: string }[] = [
  { id: 'focus', label: 'Focus' },
  { id: 'grid', label: 'Multi-chart' },
  { id: 'compare', label: '% Perf' },
];

const ApexMark: React.FC = () => (
  <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden="true">
    <rect width="32" height="32" rx="8" fill="#102127" />
    <rect x="0.5" y="0.5" width="31" height="31" rx="7.5" fill="none" stroke="#2f4f58" />
    <path d="M7 21.5 L12.5 15.5 L17 18.5 L25 10" fill="none" stroke="#69aac1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="25" cy="10" r="2" fill="#a4c5cf" />
  </svg>
);

export const Header: React.FC<HeaderProps> = ({
  page,
  setPage,
  viewMode,
  setViewMode,
  onRefresh,
  binanceConnected,
  bybitConnected,
  hyperliquidConnected = true,
  showTable,
  onToggleTable,
  showRotation,
  onToggleRotation,
}) => {
  const feeds = [binanceConnected, bybitConnected, hyperliquidConnected];
  const liveCount = feeds.filter(Boolean).length;
  const allLive = liveCount === feeds.length;

  // Chart-specific controls only make sense on the market pages
  const isMarketPage = page === 'solana' || page === 'hyperliquid' || page === 'global';

  const iconBtn =
    'inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line-strong bg-surface text-ink-dim transition-colors duration-150 hover:bg-surface-2 hover:text-ink cursor-pointer';

  return (
    <header className="sticky top-0 z-50 w-full border-b border-line bg-ground/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-5 gap-y-2 px-4 py-3 sm:px-6 lg:h-16 lg:flex-nowrap lg:py-0">
        {/* Brand + nav */}
        <div className="flex min-w-0 items-center gap-5">
          <button onClick={() => setPage('solana')} className="flex shrink-0 items-center gap-2.5 text-ink cursor-pointer">
            <ApexMark />
            <span className="text-[17px] font-semibold tracking-[-0.02em] whitespace-nowrap">Apex</span>
          </button>

          <nav aria-label="Main navigation" className="flex items-center gap-1 overflow-x-auto">
            {NAV.map((item) => {
              const active = page === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setPage(item.id)}
                  className={`relative inline-flex h-10 shrink-0 items-center rounded-lg px-3 text-sm font-semibold transition-colors cursor-pointer ${
                    active ? 'text-ink' : 'text-ink-dim hover:text-ink'
                  }`}
                >
                  {item.label}
                  {active && <span className="absolute inset-x-3 -bottom-[13px] hidden h-0.5 rounded-full bg-accent lg:block" />}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2.5">
          {isMarketPage && (
            <div className="hidden items-center gap-1 rounded-lg border border-line-strong bg-surface p-1 md:flex">
              {VIEW_MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setViewMode(m.id)}
                  className={`h-8 rounded-md px-3 text-sm font-medium transition-colors cursor-pointer ${
                    viewMode === m.id ? 'bg-line-strong text-ink-mid' : 'text-ink-dim hover:text-ink'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}

          {isMarketPage && onToggleRotation && (
            <button
              onClick={onToggleRotation}
              title="Scanner de rotation"
              className={`${iconBtn} ${showRotation ? '!border-accent !text-ink-mid' : ''}`}
            >
              <Repeat className="h-4 w-4" />
            </button>
          )}

          {isMarketPage && onToggleTable && (
            <button
              onClick={onToggleTable}
              title="Tableau 24h"
              className={`${iconBtn} ${showTable ? '!border-accent !text-ink-mid' : ''}`}
            >
              <Table className="h-4 w-4" />
            </button>
          )}

          <div
            className="hidden h-10 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink-dim sm:inline-flex"
            title={`Binance ${binanceConnected ? 'OK' : 'off'} · Bybit ${bybitConnected ? 'OK' : 'off'} · Hyperliquid ${hyperliquidConnected ? 'OK' : 'off'}`}
          >
            <span className="relative flex h-2 w-2">
              {allLive && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-up/60" />}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${allLive ? 'bg-up' : 'bg-down'}`} />
            </span>
            <span>Live</span>
            <kbd className="rounded-sm border border-line bg-well px-1.5 py-0.5 font-mono text-[10px] text-ink-dim">
              {liveCount}/{feeds.length}
            </kbd>
          </div>

          <button onClick={onRefresh} title="Synchroniser les données" className={iconBtn}>
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
