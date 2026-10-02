import React from 'react';
import type { ViewMode } from '../types/crypto';
import { Activity, Grid, Monitor, RefreshCw, TrendingUp, Table, Repeat } from 'lucide-react';

interface HeaderProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  onRefresh: () => void;
  binanceConnected: boolean;
  bybitConnected: boolean;
  activeExchangeCount: number;
  showTable?: boolean;
  onToggleTable?: () => void;
  showRotation?: boolean;
  onToggleRotation?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  viewMode,
  setViewMode,
  onRefresh,
  binanceConnected,
  bybitConnected,
  showTable,
  onToggleTable,
  showRotation,
  onToggleRotation,
}) => {
  return (
    <header className="border-b border-slate-800/80 bg-[#0d111a]/90 backdrop-blur-md sticky top-0 z-50 px-4 lg:px-6 py-3">
      <div className="max-w-[1920px] mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-indigo-600 to-cyan-400 p-0.5 shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-[#0b0e14] rounded-[10px] flex items-center justify-center">
                <Activity className="w-5 h-5 text-amber-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white m-0 flex items-center gap-1.5">
                  Apex <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-indigo-400 to-cyan-400">Terminal</span>
                </h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  v2.0 Live
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <span>Binance & Bybit Multi-Exchange Crypto Hub</span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400">Sui • SOL • ZEC • PENGU • Monad • Hyper</span>
              </p>
            </div>
          </div>

          {/* Quick status on mobile */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={onRefresh}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Exchange Status Beacons & View Switcher */}
        <div className="flex flex-wrap items-center gap-2 lg:gap-4 w-full md:w-auto justify-end">
          <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-1.5 shadow-inner">
            {/* Binance Beacon */}
            <div className="flex items-center gap-2 px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs font-medium">
              <div className="relative flex items-center justify-center">
                <span
                  className={`w-2 h-2 rounded-full ${
                    binanceConnected ? 'bg-amber-400' : 'bg-red-400'
                  }`}
                />
                {binanceConnected && (
                  <span className="absolute w-3 h-3 rounded-full bg-amber-400/40 animate-ping" />
                )}
              </div>
              <span className="text-amber-300 font-semibold">Binance</span>
              <span className="text-[10px] text-amber-400/70 hidden sm:inline">WS Live</span>
            </div>

            {/* Bybit Beacon */}
            <div className="flex items-center gap-2 px-2 py-0.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-xs font-medium">
              <div className="relative flex items-center justify-center">
                <span
                  className={`w-2 h-2 rounded-full ${
                    bybitConnected ? 'bg-cyan-400' : 'bg-red-400'
                  }`}
                />
                {bybitConnected && (
                  <span className="absolute w-3 h-3 rounded-full bg-cyan-400/40 animate-ping" />
                )}
              </div>
              <span className="text-cyan-300 font-semibold">Bybit</span>
              <span className="text-[10px] text-cyan-400/70 hidden sm:inline">V5 Feed</span>
            </div>
          </div>

          {/* View Mode Toggle: Focus vs Multi-Chart vs % Compare */}
          <div className="flex items-center bg-slate-900/90 border border-slate-800 rounded-xl p-1">
            <button
              onClick={() => setViewMode('focus')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                viewMode === 'focus'
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Focus View: Single Token Deep Dive & Order Book"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Focus</span>
            </button>

            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Multi-Chart View: 7 Individual Real-Time Candlestick Charts"
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Multi-Chart</span>
            </button>

            <button
              onClick={() => setViewMode('compare')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                viewMode === 'compare'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Comparison View: All Tokens Gain / Loss % Normalized Curves"
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-300" />
              <span>% Gain / Loss</span>
            </button>
          </div>

          {/* Swap Rotation Scanner Toggle */}
          {onToggleRotation && (
            <button
              onClick={onToggleRotation}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                showRotation
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border-slate-700/60'
              }`}
              title="Scanner de Rotation & Swap Profitable"
            >
              <Repeat className="w-3.5 h-3.5 text-emerald-400" />
              <span>Swap Rotation</span>
            </button>
          )}

          {/* Tableau 24h Toggle */}
          {onToggleTable && (
            <button
              onClick={onToggleTable}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                showTable
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border-slate-700/60'
              }`}
              title="Afficher / Masquer le Tableau 24h"
            >
              <Table className="w-3.5 h-3.5 text-amber-400" />
              <span>Tableau 24h</span>
            </button>
          )}

          {/* Refresh Action */}
          <button
            onClick={onRefresh}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700/60 transition cursor-pointer"
            title="Reload Market Data"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync</span>
          </button>
        </div>
      </div>
    </header>
  );
};
