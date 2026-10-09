import React, { useState, useEffect, useMemo } from 'react';
import type { TokenConfig, TickerData, PortfolioEntry } from '../types/crypto';
import { TOKENS } from '../config/tokens';
import { CROSS_TOKENS } from '../config/crossPairs';
import {
  Wallet,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Layers,
  Calendar,
  Sparkles,
  Download,
  Upload,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Zap,
} from 'lucide-react';

interface PortfolioDcaPageProps {
  tickers: Record<string, TickerData>;
}

const STORAGE_KEY = 'apex_portfolio_dca_entries_v2';

// 6 Core tokens highlighted for quick DCA access
const CORE_TOKEN_IDS = ['sol', 'sui', 'zec', 'mon', 'hype', 'pengu'];

export const PortfolioDcaPage: React.FC<PortfolioDcaPageProps> = ({ tickers }) => {
  // 1. Persistent entries state
  const [entries, setEntries] = useState<PortfolioEntry[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse saved portfolio entries:', e);
    }
    // Return empty by default
    return [];
  });

  // Save to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch (e) {
      console.error('Failed to save portfolio entries:', e);
    }
  }, [entries]);

  // 2. Form state for adding/editing an entry
  const [selectedTokenId, setSelectedTokenId] = useState<string>('sol');
  const [buyPriceInput, setBuyPriceInput] = useState<string>('');
  const [usdAmountInput, setUsdAmountInput] = useState<string>('10');
  const [quantityInput, setQuantityInput] = useState<string>('');
  const [noteInput, setNoteInput] = useState<string>('');
  const [entryDateInput, setEntryDateInput] = useState<string>(() => {
    return new Date().toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
  });

  // Form feedback state
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Accordion state: which tokens have their entries expanded
  const [expandedTokens, setExpandedTokens] = useState<Record<string, boolean>>({
    sol: true,
    sui: false,
    zec: false,
    mon: false,
    hype: false,
    pengu: false,
  });

  // Filter for token table: 'all' | 'profitable' | 'in-dip'
  const [filterMode, setFilterMode] = useState<'all' | 'profitable' | 'in-dip'>('all');

  // Currently selected token object
  const selectedToken = useMemo(() => {
    return TOKENS.find((t) => t.id === selectedTokenId) || TOKENS[1]; // default SOL
  }, [selectedTokenId]);

  // Current live price for selected token
  const selectedTokenLivePrice = useMemo(() => {
    const tick = tickers[selectedToken.symbol];
    return tick?.lastPrice && tick.lastPrice > 0 ? tick.lastPrice : 0;
  }, [tickers, selectedToken]);

  // Sync buyPrice input with live price if empty or on token switch
  useEffect(() => {
    if (selectedTokenLivePrice > 0 && !buyPriceInput) {
      setBuyPriceInput(selectedTokenLivePrice.toString());
    }
  }, [selectedTokenLivePrice, buyPriceInput]);

  // When USD amount changes, recalculate quantity
  const handleUsdAmountChange = (val: string) => {
    setUsdAmountInput(val);
    const usd = parseFloat(val);
    const px = parseFloat(buyPriceInput);
    if (!isNaN(usd) && !isNaN(px) && px > 0) {
      setQuantityInput((usd / px).toFixed(selectedToken.precision > 4 ? 6 : 4));
    }
  };

  // When Quantity changes, recalculate USD amount
  const handleQuantityChange = (val: string) => {
    setQuantityInput(val);
    const qty = parseFloat(val);
    const px = parseFloat(buyPriceInput);
    if (!isNaN(qty) && !isNaN(px) && px > 0) {
      setUsdAmountInput((qty * px).toFixed(2));
    }
  };

  // When Buy Price changes, update quantity if USD is present
  const handleBuyPriceChange = (val: string) => {
    setBuyPriceInput(val);
    const px = parseFloat(val);
    const usd = parseFloat(usdAmountInput);
    if (!isNaN(px) && px > 0 && !isNaN(usd)) {
      setQuantityInput((usd / px).toFixed(selectedToken.precision > 4 ? 6 : 4));
    }
  };

  // Set buy price to current live market price in 1 click
  const handleUseLivePrice = () => {
    if (selectedTokenLivePrice > 0) {
      handleBuyPriceChange(selectedTokenLivePrice.toString());
    }
  };

  // Handle Token Selection in Form
  const handleSelectFormToken = (tokenId: string) => {
    setSelectedTokenId(tokenId);
    const tok = TOKENS.find((t) => t.id === tokenId);
    if (tok) {
      const live = tickers[tok.symbol]?.lastPrice;
      if (live && live > 0) {
        setBuyPriceInput(live.toString());
        const usd = parseFloat(usdAmountInput) || 10;
        setQuantityInput((usd / live).toFixed(tok.precision > 4 ? 6 : 4));
      }
    }
  };

  // Add a new DCA Entry
  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault();

    const price = parseFloat(buyPriceInput);
    const qty = parseFloat(quantityInput);
    const usd = parseFloat(usdAmountInput);

    if (isNaN(price) || price <= 0) {
      alert("Veuillez saisir un prix d'achat valide.");
      return;
    }

    const finalQty = !isNaN(qty) && qty > 0 ? qty : (!isNaN(usd) ? usd / price : 0);
    const finalUsd = !isNaN(usd) && usd > 0 ? usd : finalQty * price;

    if (finalQty <= 0 || finalUsd <= 0) {
      alert("Veuillez renseigner un montant en USD ou une quantité de jetons.");
      return;
    }

    const timestamp = entryDateInput ? new Date(entryDateInput).getTime() : Date.now();
    const dateObj = new Date(timestamp);
    const dateLabel = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newEntry: PortfolioEntry = {
      id: `entry-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      tokenId: selectedToken.id,
      symbol: selectedToken.symbol,
      baseAsset: selectedToken.baseAsset,
      buyPrice: price,
      quantity: finalQty,
      totalUsd: finalUsd,
      timestamp,
      dateLabel,
      note: noteInput.trim() || undefined,
    };

    setEntries((prev) => [newEntry, ...prev]);

    // Automatically expand the token in the list
    setExpandedTokens((prev) => ({ ...prev, [selectedToken.id]: true }));

    // Reset some form fields
    setNoteInput('');
    setFormSuccess(`✓ Entrée ajoutée avec succès pour ${selectedToken.baseAsset} ! Nouveau Prix Moyen calculé.`);
    setTimeout(() => setFormSuccess(null), 4000);
  };

  // Delete an individual entry
  const handleDeleteEntry = (entryId: string) => {
    setEntries((prev) => prev.filter((item) => item.id !== entryId));
  };

  // Toggle accordion expansion for a token
  const toggleTokenExpand = (tokenId: string) => {
    setExpandedTokens((prev) => ({
      ...prev,
      [tokenId]: !prev[tokenId],
    }));
  };

  // Quick Action: Pre-fill form to add an entry for a specific token
  const handleQuickAddForToken = (tok: TokenConfig) => {
    handleSelectFormToken(tok.id);
    window.scrollTo({ top: 300, behavior: 'smooth' });
  };

  // Load a Starter Sample Portfolio ($10 per token across the 6 core tokens)
  const handleLoadSamplePortfolio = () => {
    const sampleEntries: PortfolioEntry[] = [];
    const now = Date.now();

    CROSS_TOKENS.forEach((tok, idx) => {
      const live = tickers[tok.symbol]?.lastPrice || (tok.id === 'sol' ? 115 : tok.id === 'sui' ? 1.10 : tok.id === 'hype' ? 84 : 10);
      
      // Entry 1: slightly lower price 3 days ago
      const px1 = live * 0.94;
      const usd1 = 15;
      const qty1 = usd1 / px1;
      const t1 = now - (3 * 24 * 3600 * 1000) - idx * 3600000;
      sampleEntries.push({
        id: `sample-${tok.id}-1`,
        tokenId: tok.id,
        symbol: tok.symbol,
        baseAsset: tok.baseAsset,
        buyPrice: px1,
        quantity: qty1,
        totalUsd: usd1,
        timestamp: t1,
        dateLabel: new Date(t1).toLocaleDateString() + ' 10:30',
        note: 'DCA Achat 1 - Support',
      });

      // Entry 2: slightly higher price 1 day ago
      const px2 = live * 1.02;
      const usd2 = 10;
      const qty2 = usd2 / px2;
      const t2 = now - (1 * 24 * 3600 * 1000) - idx * 1800000;
      sampleEntries.push({
        id: `sample-${tok.id}-2`,
        tokenId: tok.id,
        symbol: tok.symbol,
        baseAsset: tok.baseAsset,
        buyPrice: px2,
        quantity: qty2,
        totalUsd: usd2,
        timestamp: t2,
        dateLabel: new Date(t2).toLocaleDateString() + ' 16:45',
        note: 'DCA Achat 2 - Renfort',
      });
    });

    setEntries(sampleEntries);
    setFormSuccess('✓ Portefeuille exemple chargé avec succès (2 entrées par token) !');
    setTimeout(() => setFormSuccess(null), 4000);
  };

  // Clear all entries
  const handleClearAll = () => {
    if (window.confirm("Êtes-vous sûr de vouloir effacer toutes les entrées du portefeuille ?")) {
      setEntries([]);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  // Export JSON Backup
  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(entries, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `apex_portfolio_dca_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import JSON Backup
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], 'UTF-8');
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (Array.isArray(parsed)) {
            setEntries(parsed);
            alert(`✓ ${parsed.length} entrées importées avec succès !`);
          } else {
            alert('Format de fichier invalide.');
          }
        } catch (err) {
          alert("Erreur lors de la lecture du fichier JSON.");
        }
      };
    }
  };

  // 3. Compute Portfolio Aggregates Per Token
  const tokenSummaries = useMemo(() => {
    // Map of token configurations for quick lookup
    const tokenMap = new Map<string, TokenConfig>();
    TOKENS.forEach((t) => tokenMap.set(t.id, t));

    // Group entries by token
    const grouped = new Map<string, PortfolioEntry[]>();
    entries.forEach((e) => {
      const list = grouped.get(e.tokenId) || [];
      list.push(e);
      grouped.set(e.tokenId, list);
    });

    // Make sure the 6 core tokens are listed even if they have 0 entries yet
    CORE_TOKEN_IDS.forEach((id) => {
      if (!grouped.has(id)) {
        grouped.set(id, []);
      }
    });

    const summaries = Array.from(grouped.entries()).map(([tokenId, tokenEntries]) => {
      const tok = tokenMap.get(tokenId) || TOKENS[0];
      const livePrice = tickers[tok.symbol]?.lastPrice || 0;

      let totalUnits = 0;
      let totalInvestedUsd = 0;

      tokenEntries.forEach((entry) => {
        totalUnits += entry.quantity;
        totalInvestedUsd += entry.totalUsd;
      });

      // WEIGHTED AVERAGE PRICE (PRIX MOYEN PONDÉRÉ)
      const averagePrice = totalUnits > 0 ? totalInvestedUsd / totalUnits : 0;

      // Current Value
      const currentValueUsd = totalUnits * livePrice;

      // Net PnL relative to average price
      const pnlUsd = currentValueUsd - totalInvestedUsd;
      const pnlPct = averagePrice > 0 ? ((livePrice - averagePrice) / averagePrice) * 100 : 0;
      const isProfit = pnlUsd >= 0;

      return {
        token: tok,
        entriesCount: tokenEntries.length,
        totalUnits,
        totalInvestedUsd,
        averagePrice,
        currentPrice: livePrice,
        currentValueUsd,
        pnlUsd,
        pnlPct,
        isProfit,
        entries: tokenEntries.sort((a, b) => b.timestamp - a.timestamp), // newest first
      };
    });

    // Sort: tokens with entries first (by invested USD), then empty tokens
    return summaries.sort((a, b) => {
      if (a.entriesCount > 0 && b.entriesCount === 0) return -1;
      if (a.entriesCount === 0 && b.entriesCount > 0) return 1;
      return b.totalInvestedUsd - a.totalInvestedUsd;
    });
  }, [entries, tickers]);

  // Filtered summaries
  const filteredSummaries = useMemo(() => {
    if (filterMode === 'profitable') {
      return tokenSummaries.filter((s) => s.entriesCount > 0 && s.pnlPct >= 0);
    }
    if (filterMode === 'in-dip') {
      return tokenSummaries.filter((s) => s.entriesCount > 0 && s.pnlPct < 0);
    }
    return tokenSummaries;
  }, [tokenSummaries, filterMode]);

  // Overall Global Portfolio Stats
  const globalStats = useMemo(() => {
    let totalInvestedUsd = 0;
    let totalCurrentValueUsd = 0;
    let activeTokensCount = 0;
    let profitableTokensCount = 0;

    tokenSummaries.forEach((s) => {
      if (s.entriesCount > 0) {
        totalInvestedUsd += s.totalInvestedUsd;
        totalCurrentValueUsd += s.currentValueUsd;
        activeTokensCount += 1;
        if (s.pnlPct >= 0) profitableTokensCount += 1;
      }
    });

    const netPnlUsd = totalCurrentValueUsd - totalInvestedUsd;
    const netPnlPct = totalInvestedUsd > 0 ? (netPnlUsd / totalInvestedUsd) * 100 : 0;

    return {
      totalInvestedUsd,
      totalCurrentValueUsd,
      netPnlUsd,
      netPnlPct,
      activeTokensCount,
      profitableTokensCount,
      totalEntriesCount: entries.length,
    };
  }, [tokenSummaries, entries]);

  // Helper formatters
  const formatUsd = (val: number, showSign: boolean = true) => {
    const sign = val > 0.0001 ? '+' : val < -0.0001 ? '-' : '';
    const formatted = Math.abs(val).toFixed(2);
    return showSign && sign ? `${sign}$${formatted}` : `$${formatted}`;
  };

  const formatPct = (val: number) => {
    const sign = val > 0.0001 ? '+' : '';
    return `${sign}${val.toFixed(2)}%`;
  };

  return (
    <div className="flex-1 bg-[#090d14] p-4 lg:p-8 space-y-8 max-w-[1920px] mx-auto w-full">
      {/* 1. HERO HEADER BAR */}
      <div className="bg-[#0b0e14] border border-slate-800 rounded-3xl p-6 lg:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 via-indigo-600 to-purple-600 p-0.5 shadow-xl shadow-emerald-500/20">
                <div className="w-full h-full bg-[#0b0e14] rounded-[14px] flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-emerald-400" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-2xl font-black text-white tracking-tight m-0">
                    Portefeuille & Suivi DCA (Average Price Tracker)
                  </h2>
                  <span className="text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Calcul Automatique En Direct
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Enregistrez vos entrées d'achat, calculez automatiquement le <strong>Prix Moyen Pondéré (Average Price)</strong> de chaque token, et visualisez vos profits/pertes réels en temps réel.
                </p>
              </div>
            </div>
          </div>

          {/* Backup & Sample Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleLoadSamplePortfolio}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-bold transition cursor-pointer"
              title="Charger un exemple de portefeuille DCA"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Charger Exemple ($10/token)</span>
            </button>

            <button
              onClick={handleExportJson}
              disabled={entries.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer disabled:opacity-40"
              title="Télécharger une sauvegarde JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Sauvegarder</span>
            </button>

            <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>Importer</span>
              <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
            </label>

            {entries.length > 0 && (
              <button
                onClick={handleClearAll}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-950/30 hover:bg-rose-900/40 border border-rose-800/40 text-rose-300 text-xs font-semibold transition cursor-pointer"
                title="Effacer toutes les entrées"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* 2. BIG PORTFOLIO KPI CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {/* Card 1: Total Invested USD */}
          <div className="bg-[#0e131d] p-5 rounded-2xl border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
              <span className="flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-slate-500" />
                <span>Capital Total Investi</span>
              </span>
              <span className="text-[10px] font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                {globalStats.totalEntriesCount} Entrées
              </span>
            </div>
            <div className="text-3xl font-black font-mono text-white mt-3">
              ${globalStats.totalInvestedUsd.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Coût total d'achat accumulé
            </div>
          </div>

          {/* Card 2: Current Portfolio Value */}
          <div className="bg-[#0e131d] p-5 rounded-2xl border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
              <span className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-400" />
                <span>Valeur Actuelle du Portefeuille</span>
              </span>
              <span className="text-[10px] font-mono bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded">
                Prix Live
              </span>
            </div>
            <div className="text-3xl font-black font-mono text-slate-100 mt-3">
              ${globalStats.totalCurrentValueUsd.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Valeur au cours actuel du marché
            </div>
          </div>

          {/* Card 3: Unrealized Profit / Loss (PnL) */}
          <div className={`p-5 rounded-2xl border flex flex-col justify-between relative shadow-lg ${
            globalStats.netPnlUsd >= 0
              ? 'bg-gradient-to-br from-[#0c221a] to-[#0e171f] border-emerald-500/40 ring-1 ring-emerald-500/20'
              : 'bg-gradient-to-br from-[#241116] to-[#0e171f] border-rose-500/40 ring-1 ring-rose-500/20'
          }`}>
            <div className="flex items-center justify-between text-xs font-bold">
              <span className={`flex items-center gap-1.5 ${
                globalStats.netPnlUsd >= 0 ? 'text-emerald-300' : 'text-rose-300'
              }`}>
                {globalStats.netPnlUsd >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                <span>Profit / Perte Net (PnL Global)</span>
              </span>
              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                globalStats.netPnlUsd >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
              }`}>
                {globalStats.netPnlUsd >= 0 ? 'En Gain' : 'En Perte'}
              </span>
            </div>
            <div className={`text-3xl font-black font-mono mt-3 flex items-baseline gap-2 ${
              globalStats.netPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              <span>{formatUsd(globalStats.netPnlUsd)}</span>
              <span className="text-sm font-bold">
                ({formatPct(globalStats.netPnlPct)})
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Calculé par rapport aux prix moyens de revient
            </div>
          </div>

          {/* Card 4: Tokens Win-Rate */}
          <div className="bg-[#0e131d] p-5 rounded-2xl border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
              <span>État des Positions</span>
              <span className="text-[10px] font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                {globalStats.activeTokensCount} Actifs
              </span>
            </div>
            <div className="text-3xl font-black font-mono text-white mt-3">
              <span className="text-emerald-400">{globalStats.profitableTokensCount}</span>
              <span className="text-slate-500 text-xl font-normal mx-1">/</span>
              <span className="text-slate-300">{globalStats.activeTokensCount}</span>
              <span className="text-xs font-bold text-slate-400 ml-2">
                ({globalStats.activeTokensCount > 0 ? ((globalStats.profitableTokensCount / globalStats.activeTokensCount) * 100).toFixed(0) : 0}% Verts)
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Tokens au-dessus de leur prix d'achat moyen
            </div>
          </div>
        </div>
      </div>

      {/* 3. FORMULAIRE D'AJOUT D'ENTRÉE (ADD DCA ENTRY FORM) */}
      <div className="bg-[#0b0e14] border border-slate-800 rounded-3xl p-6 lg:p-8 space-y-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight m-0">
                Enregistrer une Entrée d'Achat (Nouvel Achat DCA)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Chaque entrée mettra à jour instantanément le <strong>Prix Moyen (Average Price)</strong> et recalculera vos gains/pertes en direct.
              </p>
            </div>
          </div>

          {formSuccess && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold animate-pulse">
              <CheckCircle2 className="w-4 h-4" />
              <span>{formSuccess}</span>
            </div>
          )}
        </div>

        {/* Quick Token Selector Chips (Solana, Sui, Zcash, Monad, Hyperliquid, Pengu, etc.) */}
        <div className="space-y-2">
          <label className="text-xs text-slate-400 font-semibold block">
            1. Sélectionner le Token :
          </label>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {CORE_TOKEN_IDS.map((id) => {
              const tok = TOKENS.find((t) => t.id === id);
              if (!tok) return null;
              const isSelected = selectedTokenId === id;
              const livePx = tickers[tok.symbol]?.lastPrice;

              return (
                <button
                  type="button"
                  key={id}
                  onClick={() => handleSelectFormToken(id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 border ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-900/40'
                      : 'bg-[#0e131d] text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black text-white bg-gradient-to-br ${tok.accentGradient}`}>
                    {tok.baseAsset.slice(0, 3)}
                  </div>
                  <span>{tok.baseAsset}</span>
                  {livePx && (
                    <span className="text-[10px] font-mono text-slate-300 font-normal">
                      ${livePx < 1 ? livePx.toFixed(3) : livePx.toFixed(2)}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Other Tokens Dropdown */}
            <div className="shrink-0">
              <select
                value={selectedTokenId}
                onChange={(e) => handleSelectFormToken(e.target.value)}
                className="bg-[#0e131d] text-xs font-bold text-slate-300 border border-slate-800 rounded-xl px-3 py-2 focus:outline-none cursor-pointer"
              >
                <option value="" disabled>Autre token...</option>
                {TOKENS.filter((t) => !CORE_TOKEN_IDS.includes(t.id)).map((tok) => (
                  <option key={tok.id} value={tok.id}>
                    {tok.baseAsset} - {tok.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Input Fields Grid */}
        <form onSubmit={handleAddEntry} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Prix d'Achat Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs text-slate-300 font-semibold">
                Prix d'Achat ($ USD) :
              </label>
              {selectedTokenLivePrice > 0 && (
                <button
                  type="button"
                  onClick={handleUseLivePrice}
                  className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5 cursor-pointer"
                  title="Utiliser le prix actuel du marché"
                >
                  <Zap className="w-3 h-3" />
                  <span>Live: ${selectedTokenLivePrice < 1 ? selectedTokenLivePrice.toFixed(4) : selectedTokenLivePrice.toFixed(2)}</span>
                </button>
              )}
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                $
              </div>
              <input
                type="number"
                step="any"
                required
                value={buyPriceInput}
                onChange={(e) => handleBuyPriceChange(e.target.value)}
                placeholder="Ex: 118.50"
                className="w-full bg-[#0e131d] border border-slate-800 focus:border-indigo-500 rounded-xl pl-7 pr-3 py-2.5 text-sm font-mono font-bold text-white placeholder-slate-600 focus:outline-none transition"
              />
            </div>
          </div>

          {/* Montant USD Investi */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-300 font-semibold block">
              Montant Investi ($ USD) :
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                $
              </div>
              <input
                type="number"
                step="any"
                value={usdAmountInput}
                onChange={(e) => handleUsdAmountChange(e.target.value)}
                placeholder="Ex: 10"
                className="w-full bg-[#0e131d] border border-slate-800 focus:border-indigo-500 rounded-xl pl-7 pr-3 py-2.5 text-sm font-mono font-bold text-white placeholder-slate-600 focus:outline-none transition"
              />
            </div>
          </div>

          {/* Quantité de Jetons */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-300 font-semibold block">
              Quantité de {selectedToken.baseAsset} :
            </label>
            <input
              type="number"
              step="any"
              value={quantityInput}
              onChange={(e) => handleQuantityChange(e.target.value)}
              placeholder="Ex: 0.085"
              className="w-full bg-[#0e131d] border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-sm font-mono font-bold text-white placeholder-slate-600 focus:outline-none transition"
            />
          </div>

          {/* Date & Submit */}
          <div className="space-y-1.5 flex flex-col justify-end">
            <label className="text-xs text-slate-300 font-semibold block">
              Date & Heure :
            </label>
            <input
              type="datetime-local"
              value={entryDateInput}
              onChange={(e) => setEntryDateInput(e.target.value)}
              className="w-full bg-[#0e131d] border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-mono text-slate-300 focus:outline-none transition"
            />
          </div>

          {/* Note Optionnelle & Submit Row */}
          <div className="md:col-span-2 lg:col-span-3 space-y-1.5">
            <label className="text-xs text-slate-400 font-semibold block">
              Note / Tag (Optionnel) :
            </label>
            <input
              type="text"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="Ex: Achat Dip -8%, DCA hebdomadaire, Ordre Limite exécuté..."
              className="w-full bg-[#0e131d] border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none transition"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/40 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Enregistrer l'Entrée</span>
            </button>
          </div>
        </form>
      </div>

      {/* 4. TABLEAU PRINCIPAL DES TOKENS & PRIX MOYEN (CORE REQUEST) */}
      <div className="space-y-4">
        {/* Table Controls & Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            <h3 className="text-lg font-bold text-white tracking-tight m-0">
              Performance par Token & Prix Moyen (DCA Table)
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                filterMode === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-[#0e131d] text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Tous ({tokenSummaries.length})
            </button>

            <button
              onClick={() => setFilterMode('profitable')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                filterMode === 'profitable'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[#0e131d] text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              En Profit 🟢
            </button>

            <button
              onClick={() => setFilterMode('in-dip')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                filterMode === 'in-dip'
                  ? 'bg-rose-600 text-white'
                  : 'bg-[#0e131d] text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              En Perte 🔴
            </button>
          </div>
        </div>

        {/* The Detailed Token Cards & Accordion Table */}
        <div className="space-y-3">
          {filteredSummaries.map((summary) => {
            const hasEntries = summary.entriesCount > 0;
            const isExpanded = !!expandedTokens[summary.token.id];

            return (
              <div
                key={summary.token.id}
                className={`rounded-2xl border transition overflow-hidden ${
                  hasEntries
                    ? summary.isProfit
                      ? 'bg-[#0d121c] border-emerald-900/40 hover:border-emerald-600/50'
                      : 'bg-[#0d121c] border-rose-900/40 hover:border-rose-600/50'
                    : 'bg-[#0b0e14] border-slate-800/80 opacity-75'
                }`}
              >
                {/* Main Row / Header of Token */}
                <div className="p-4 lg:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Token Identity */}
                  <div className="flex items-center gap-3 min-w-[200px]">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-md bg-gradient-to-br ${summary.token.accentGradient}`}
                    >
                      {summary.token.baseAsset.slice(0, 3)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{summary.token.baseAsset}</span>
                        <span className="text-[10px] uppercase font-bold text-slate-400 px-1.5 py-0.2 rounded bg-slate-800">
                          {summary.token.exchange}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 block">{summary.token.name}</span>
                    </div>
                  </div>

                  {/* Prix Moyen vs Prix Actuel (Key Insight) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1">
                    {/* 1. Prix Moyen (DCA) */}
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                        Prix Moyen (DCA)
                      </span>
                      {hasEntries ? (
                        <div className="text-sm font-black font-mono text-indigo-300 mt-0.5">
                          ${summary.averagePrice < 1 ? summary.averagePrice.toFixed(4) : summary.averagePrice.toFixed(2)}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500 font-mono">Aucun achat</span>
                      )}
                    </div>

                    {/* 2. Prix Actuel Live */}
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                        Prix Actuel Live
                      </span>
                      <div className="text-sm font-black font-mono text-white mt-0.5">
                        ${summary.currentPrice < 1 ? summary.currentPrice.toFixed(4) : summary.currentPrice.toFixed(2)}
                      </div>
                    </div>

                    {/* 3. Total Investi / Jetons */}
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                        Total Investi / Jetons
                      </span>
                      {hasEntries ? (
                        <div className="text-xs font-mono text-slate-200 mt-0.5">
                          <strong className="text-white">${summary.totalInvestedUsd.toFixed(2)}</strong>
                          <span className="text-slate-400 text-[11px] block">
                            {summary.totalUnits < 1 ? summary.totalUnits.toFixed(4) : summary.totalUnits.toFixed(2)} {summary.token.baseAsset}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500 font-mono">$0.00</span>
                      )}
                    </div>

                    {/* 4. Valeur Actuelle */}
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                        Valeur Actuelle
                      </span>
                      {hasEntries ? (
                        <div className="text-sm font-black font-mono text-slate-100 mt-0.5">
                          ${summary.currentValueUsd.toFixed(2)}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500 font-mono">$0.00</span>
                      )}
                    </div>
                  </div>

                  {/* PnL Status & Actions */}
                  <div className="flex items-center justify-between lg:justify-end gap-4 min-w-[220px]">
                    {hasEntries ? (
                      <div className="text-right">
                        <div className={`text-base font-black font-mono ${
                          summary.isProfit ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {formatUsd(summary.pnlUsd)}
                        </div>
                        <div className={`text-xs font-bold inline-flex items-center gap-1 ${
                          summary.isProfit ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {summary.isProfit ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          <span>{formatPct(summary.pnlPct)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 italic">
                        Prêt pour le DCA
                      </div>
                    )}

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleQuickAddForToken(summary.token)}
                        className="p-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 transition cursor-pointer"
                        title={`Ajouter un achat pour ${summary.token.baseAsset}`}
                      >
                        <Plus className="w-4 h-4" />
                      </button>

                      {hasEntries && (
                        <button
                          onClick={() => toggleTokenExpand(summary.token.id)}
                          className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
                        >
                          <span>{summary.entriesCount}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Ledger of Entries for this Token */}
                {hasEntries && isExpanded && (
                  <div className="border-t border-slate-800 bg-[#090d14]/80 p-4 lg:p-5 space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <div className="flex items-center gap-1.5 font-bold text-slate-300">
                        <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Journal des Achats ({summary.entriesCount} transactions DCA)</span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        Prix Moyen Actuel : <strong className="text-indigo-300 font-mono">${summary.averagePrice < 1 ? summary.averagePrice.toFixed(4) : summary.averagePrice.toFixed(2)}</strong>
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-800/80">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className="bg-[#0e131d] text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                          <tr>
                            <th className="py-2.5 px-3">Date / Heure</th>
                            <th className="py-2.5 px-3 text-right">Prix d'Achat</th>
                            <th className="py-2.5 px-3 text-right">Quantité</th>
                            <th className="py-2.5 px-3 text-right">Montant USD</th>
                            <th className="py-2.5 px-3 text-right">Gain sur cette entrée</th>
                            <th className="py-2.5 px-3">Note</th>
                            <th className="py-2.5 px-3 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summary.entries.map((entry, idx) => {
                            const entryPnlPct = entry.buyPrice > 0 ? ((summary.currentPrice - entry.buyPrice) / entry.buyPrice) * 100 : 0;
                            const isEntryProfit = entryPnlPct >= 0;

                            return (
                              <tr
                                key={entry.id}
                                className="border-b border-slate-800/50 hover:bg-slate-800/20 transition"
                              >
                                <td className="py-2.5 px-3 text-slate-400">
                                  #{summary.entries.length - idx} • {entry.dateLabel}
                                </td>

                                <td className="py-2.5 px-3 text-right font-bold text-white">
                                  ${entry.buyPrice < 1 ? entry.buyPrice.toFixed(4) : entry.buyPrice.toFixed(2)}
                                </td>

                                <td className="py-2.5 px-3 text-right text-slate-300">
                                  {entry.quantity < 1 ? entry.quantity.toFixed(4) : entry.quantity.toFixed(2)}
                                </td>

                                <td className="py-2.5 px-3 text-right font-bold text-slate-200">
                                  ${entry.totalUsd.toFixed(2)}
                                </td>

                                <td className="py-2.5 px-3 text-right">
                                  <span className={`font-bold px-1.5 py-0.5 rounded text-[11px] ${
                                    isEntryProfit
                                      ? 'text-emerald-400 bg-emerald-500/10'
                                      : 'text-rose-400 bg-rose-500/10'
                                  }`}>
                                    {formatPct(entryPnlPct)}
                                  </span>
                                </td>

                                <td className="py-2.5 px-3 text-slate-400 italic">
                                  {entry.note || <span className="text-slate-600">-</span>}
                                </td>

                                <td className="py-2.5 px-3 text-center">
                                  <button
                                    onClick={() => handleDeleteEntry(entry.id)}
                                    className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition cursor-pointer"
                                    title="Supprimer cette entrée"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
