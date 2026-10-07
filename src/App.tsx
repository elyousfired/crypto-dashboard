import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { TOKENS, SOLANA_TOKENS, HYPERLIQUID_TOKENS, GLOBAL_TOKENS, TIMEFRAMES } from './config/tokens';
import type {
  TokenConfig,
  TickerData,
  CandleData,
  TradeItem,
  OrderBookData,
  Timeframe,
  ChartType,
  ViewMode,
  Stats30d,
  DashboardPage,
} from './types/crypto';
import {
  fetchBinanceTickers,
  fetchBinanceKlines,
  fetchBinanceTrades,
  fetchBinanceOrderBook,
  fetchBinance30dStats,
  BinanceWebSocketManager,
} from './services/binanceService';
import {
  fetchBybitTickers,
  fetchBybitKlines,
  fetchBybitTrades,
  fetchBybitOrderBook,
  fetchBybit30dStats,
  BybitWebSocketManager,
} from './services/bybitService';
import {
  fetchHyperliquidTickers,
  fetchHyperliquidKlines,
  fetchHyperliquidTrades,
  fetchHyperliquidOrderBook,
  fetchHyperliquid30dStats,
  HyperliquidWebSocketManager,
} from './services/hyperliquidService';
import { Header } from './components/Header';
import { TickerBar } from './components/TickerBar';
import { TokenStats } from './components/TokenStats';
import { ChartControls } from './components/ChartControls';
import { ChartContainer } from './components/ChartContainer';
import { OrderBookTrades } from './components/OrderBookTrades';
import { MultiChartView } from './components/MultiChartView';
import { ComparePerformanceChart } from './components/ComparePerformanceChart';
import { RotationSwapScanner } from './components/RotationSwapScanner';
import { MarketTable24h } from './components/MarketTable24h';
import { SolanaEcosystemSection } from './components/SolanaEcosystemSection';
import { HyperliquidEcosystemSection } from './components/HyperliquidEcosystemSection';

export const App: React.FC = () => {
  // Navigation: Dedicated Page ('solana' | 'hyperliquid' | 'global')
  const [activePage, setActivePage] = useState<DashboardPage>(() => {
    if (typeof window !== 'undefined') {
      if (window.location.hash === '#global') return 'global';
      if (window.location.hash === '#hyperliquid') return 'hyperliquid';
    }
    return 'solana'; // Defaults to dedicated Solana page
  });

  const currentTokens = useMemo(() => {
    if (activePage === 'solana') return SOLANA_TOKENS;
    if (activePage === 'hyperliquid') return HYPERLIQUID_TOKENS;
    return GLOBAL_TOKENS;
  }, [activePage]);

  // Selected token defaults to SOL on solana page, HYPE on hyperliquid page, SUI on global page
  const [selectedToken, setSelectedToken] = useState<TokenConfig>(() => {
    if (typeof window !== 'undefined') {
      if (window.location.hash === '#global') return GLOBAL_TOKENS[0];
      if (window.location.hash === '#hyperliquid') return HYPERLIQUID_TOKENS[0];
    }
    return SOLANA_TOKENS[0];
  });

  // Navigation & View mode: focus | grid | compare
  const [viewMode, setViewMode] = useState<ViewMode>('focus');
  const [showOrderBook, setShowOrderBook] = useState<boolean>(true); // Affiché / Désaffiché Order Book
  const [showRotationScanner, setShowRotationScanner] = useState<boolean>(true); // Affiché / Désaffiché Swap Scanner
  const [showMarketTable, setShowMarketTable] = useState<boolean>(true); // Affiché / Désaffiché Tableau 24h

  const handleSetPage = (page: DashboardPage) => {
    setActivePage(page);
    if (typeof window !== 'undefined') {
      window.location.hash = page;
    }
    if (page === 'solana') {
      setSelectedToken(SOLANA_TOKENS[0]); // SOL
    } else if (page === 'hyperliquid') {
      setSelectedToken(HYPERLIQUID_TOKENS[0]); // HYPE
    } else {
      setSelectedToken(GLOBAL_TOKENS[0]); // SUI
    }
  };

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash === '#global') {
        setActivePage('global');
        setSelectedToken(GLOBAL_TOKENS[0]);
      } else if (hash === '#hyperliquid') {
        setActivePage('hyperliquid');
        setSelectedToken(HYPERLIQUID_TOKENS[0]);
      } else if (hash === '#solana') {
        setActivePage('solana');
        setSelectedToken(SOLANA_TOKENS[0]);
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Chart configuration
  const [timeframe, setTimeframe] = useState<Timeframe>('1h');
  const [chartType, setChartType] = useState<ChartType>('candlestick');
  const [showMA, setShowMA] = useState<boolean>(true);
  const [showBollinger, setShowBollinger] = useState<boolean>(false);
  const [showVolume, setShowVolume] = useState<boolean>(true);

  // Comparative chart timeframe (supports 15m, 1h, 4h, 1d)
  const [compareTimeframe, setCompareTimeframe] = useState<string>('15m');

  // Market data states
  const [tickers, setTickers] = useState<Record<string, TickerData>>({});
  const [stats30dMap, setStats30dMap] = useState<Record<string, Stats30d>>({});
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [multiCandles, setMultiCandles] = useState<Record<string, CandleData[]>>({});
  const [trades, setTrades] = useState<TradeItem[]>([]);
  const [orderBook, setOrderBook] = useState<OrderBookData>({ bids: [], asks: [] });
  const [latestCandle, setLatestCandle] = useState<CandleData | null>(null);

  // Connection states
  const [binanceConnected, setBinanceConnected] = useState<boolean>(true);
  const [bybitConnected, setBybitConnected] = useState<boolean>(true);
  const [hyperliquidConnected, setHyperliquidConnected] = useState<boolean>(true);
  const [isLoadingCandles, setIsLoadingCandles] = useState<boolean>(false);

  // WebSocket Managers references
  const binanceWsRef = useRef<BinanceWebSocketManager | null>(null);
  const bybitWsRef = useRef<BybitWebSocketManager | null>(null);
  const hyperliquidWsRef = useRef<HyperliquidWebSocketManager | null>(null);

  // 1. Initial Ticker Fetching
  const loadAllTickers = useCallback(async () => {
    const binanceTokens = TOKENS.filter((t) => t.exchange === 'binance').map((t) => t.symbol);
    const bybitTokens = TOKENS.filter((t) => t.exchange === 'bybit').map((t) => t.symbol);
    const hlTokens = TOKENS.filter((t) => t.exchange === 'hyperliquid');

    const [bTickers, byTickers, hlTickers] = await Promise.all([
      fetchBinanceTickers(binanceTokens),
      fetchBybitTickers(bybitTokens, 'spot'),
      fetchHyperliquidTickers(hlTokens),
    ]);

    setTickers((prev) => {
      const next = { ...prev };
      bTickers.forEach((t) => {
        next[t.symbol] = t;
      });
      byTickers.forEach((t) => {
        next[t.symbol] = t;
      });
      hlTickers.forEach((t) => {
        next[t.symbol] = t;
      });
      return next;
    });

    setBinanceConnected(bTickers.length > 0);
    setBybitConnected(byTickers.length > 0);
    setHyperliquidConnected(hlTickers.length > 0);
  }, []);

  // 2. Fetch 30-Day High & Drawdown Stats for all tokens
  const load30dStats = useCallback(async () => {
    const results: Record<string, Stats30d> = {};
    await Promise.all(
      TOKENS.map(async (token) => {
        try {
          if (token.exchange === 'binance') {
            const s = await fetchBinance30dStats(token.symbol);
            if (s) results[token.symbol] = s;
          } else if (token.exchange === 'hyperliquid') {
            const s = await fetchHyperliquid30dStats(token.hyperliquidCoin || token.symbol);
            if (s) results[token.symbol] = s;
          } else {
            const s = await fetchBybit30dStats(token.symbol, token.bybitCategory || 'spot');
            if (s) results[token.symbol] = s;
          }
        } catch (err) {
          console.warn(`Error fetching 30d stats for ${token.symbol}:`, err);
        }
      })
    );
    setStats30dMap((prev) => ({ ...prev, ...results }));
  }, []);

  // 3. Fetch Active Token Candle & Orderbook Data
  const loadActiveTokenData = useCallback(async () => {
    setIsLoadingCandles(true);
    const tfConfig = TIMEFRAMES.find((tf) => tf.value === timeframe) || TIMEFRAMES[3];

    try {
      if (selectedToken.exchange === 'binance') {
        const [klineData, tradeData, bookData] = await Promise.all([
          fetchBinanceKlines(selectedToken.symbol, tfConfig.binanceInterval, 200),
          fetchBinanceTrades(selectedToken.symbol, 30),
          fetchBinanceOrderBook(selectedToken.symbol, 15),
        ]);
        setCandles(klineData);
        setTrades(tradeData);
        setOrderBook(bookData);
      } else if (selectedToken.exchange === 'hyperliquid') {
        const coin = selectedToken.hyperliquidCoin || selectedToken.baseAsset;
        const [klineData, tradeData, bookData] = await Promise.all([
          fetchHyperliquidKlines(coin, timeframe, 200),
          fetchHyperliquidTrades(coin, 30),
          fetchHyperliquidOrderBook(coin, 15),
        ]);
        setCandles(klineData);
        setTrades(tradeData);
        setOrderBook(bookData);
      } else {
        const [klineData, tradeData, bookData] = await Promise.all([
          fetchBybitKlines(selectedToken.symbol, tfConfig.bybitInterval, selectedToken.bybitCategory || 'spot', 200),
          fetchBybitTrades(selectedToken.symbol, selectedToken.bybitCategory || 'spot', 30),
          fetchBybitOrderBook(selectedToken.symbol, selectedToken.bybitCategory || 'spot', 15),
        ]);
        setCandles(klineData);
        setTrades(tradeData);
        setOrderBook(bookData);
      }
    } catch (err) {
      console.error('Failed to load active token data:', err);
    } finally {
      setIsLoadingCandles(false);
    }
  }, [selectedToken, timeframe]);

  // 4. Fetch Multi-Candles for Grid View & Comparative Chart (supports 15m, 1h, 4h, 1d)
  const loadMultiCandles = useCallback(async (tf: string = '15m') => {
    const binanceInterval = tf === '15m' ? '15m' : tf === '4h' ? '4h' : tf === '1d' ? '1d' : '1h';
    const bybitInterval = tf === '15m' ? '15' : tf === '4h' ? '240' : tf === '1d' ? 'D' : '60';

    const results: Record<string, CandleData[]> = {};
    await Promise.all(
      TOKENS.map(async (token) => {
        try {
          if (token.exchange === 'binance') {
            const data = await fetchBinanceKlines(token.symbol, binanceInterval, 100);
            results[token.symbol] = data;
          } else if (token.exchange === 'hyperliquid') {
            const coin = token.hyperliquidCoin || token.baseAsset;
            const data = await fetchHyperliquidKlines(coin, tf, 100);
            results[token.symbol] = data;
          } else {
            const data = await fetchBybitKlines(token.symbol, bybitInterval, 'spot', 100);
            results[token.symbol] = data;
          }
        } catch (e) {
          console.warn(`Error prefetching candles for ${token.symbol}:`, e);
        }
      })
    );
    setMultiCandles((prev) => ({ ...prev, ...results }));
  }, []);

  // Initialize on mount
  useEffect(() => {
    loadAllTickers();
    load30dStats();
    loadMultiCandles(compareTimeframe);

    const pollInterval = setInterval(() => {
      loadAllTickers();
    }, 10000);

    return () => clearInterval(pollInterval);
  }, [loadAllTickers, load30dStats, loadMultiCandles, compareTimeframe]);

  // Reload data when active token or timeframe changes
  useEffect(() => {
    loadActiveTokenData();

    const tradesInterval = setInterval(() => {
      if (selectedToken.exchange === 'binance') {
        fetchBinanceTrades(selectedToken.symbol, 30).then((t) => t.length && setTrades(t));
        fetchBinanceOrderBook(selectedToken.symbol, 15).then((b) => b.bids.length && setOrderBook(b));
      } else if (selectedToken.exchange === 'hyperliquid') {
        const coin = selectedToken.hyperliquidCoin || selectedToken.baseAsset;
        fetchHyperliquidTrades(coin, 30).then((t) => t.length && setTrades(t));
        fetchHyperliquidOrderBook(coin, 15).then((b) => b.bids.length && setOrderBook(b));
      } else {
        fetchBybitTrades(selectedToken.symbol, 'spot', 30).then((t) => t.length && setTrades(t));
        fetchBybitOrderBook(selectedToken.symbol, 'spot', 15).then((b) => b.bids.length && setOrderBook(b));
      }
    }, 4000);

    return () => clearInterval(tradesInterval);
  }, [selectedToken, timeframe, loadActiveTokenData]);

  // 5. WebSocket Connections for Real-Time Ticker & Kline streaming
  useEffect(() => {
    const tfConfig = TIMEFRAMES.find((tf) => tf.value === timeframe) || TIMEFRAMES[3];
    const binanceSymbols = TOKENS.filter((t) => t.exchange === 'binance').map((t) => t.symbol);
    const bybitSymbols = TOKENS.filter((t) => t.exchange === 'bybit').map((t) => t.symbol);
    const hlTokens = TOKENS.filter((t) => t.exchange === 'hyperliquid');

    // Binance WebSocket
    binanceWsRef.current = new BinanceWebSocketManager(
      binanceSymbols,
      (updatedTicker) => {
        setTickers((prev) => ({
          ...prev,
          [updatedTicker.symbol]: {
            ...(prev[updatedTicker.symbol] || {}),
            ...updatedTicker,
          } as TickerData,
        }));
      },
      (candle) => {
        if (candle.symbol === selectedToken.symbol) {
          setLatestCandle(candle);
        }
      }
    );
    binanceWsRef.current.connect(tfConfig.binanceInterval);

    // Bybit WebSocket
    bybitWsRef.current = new BybitWebSocketManager(
      bybitSymbols,
      (updatedTicker) => {
        setTickers((prev) => ({
          ...prev,
          [updatedTicker.symbol]: {
            ...(prev[updatedTicker.symbol] || {}),
            ...updatedTicker,
          } as TickerData,
        }));
      },
      (candle) => {
        if (candle.symbol === selectedToken.symbol) {
          setLatestCandle(candle);
        }
      }
    );
    bybitWsRef.current.connect(tfConfig.bybitInterval);

    // Hyperliquid WebSocket
    hyperliquidWsRef.current = new HyperliquidWebSocketManager(
      hlTokens,
      (updatedTicker) => {
        setTickers((prev) => ({
          ...prev,
          [updatedTicker.symbol]: {
            ...(prev[updatedTicker.symbol] || {}),
            ...updatedTicker,
          } as TickerData,
        }));
      },
      (candle) => {
        if (candle.symbol === selectedToken.symbol) {
          setLatestCandle(candle);
        }
      }
    );
    const activeHlCoin = selectedToken.exchange === 'hyperliquid' ? (selectedToken.hyperliquidCoin || selectedToken.baseAsset) : undefined;
    hyperliquidWsRef.current.connect(activeHlCoin, timeframe);

    return () => {
      binanceWsRef.current?.disconnect();
      bybitWsRef.current?.disconnect();
      hyperliquidWsRef.current?.disconnect();
    };
  }, [selectedToken, timeframe]);

  const handleSelectToken = (token: TokenConfig) => {
    setSelectedToken(token);
    if (viewMode !== 'focus') {
      setViewMode('focus');
    }
  };

  const handleCompareTimeframeChange = (tf: string) => {
    setCompareTimeframe(tf);
    loadMultiCandles(tf);
  };

  return (
    <div className="min-h-screen bg-[#090d14] text-slate-100 flex flex-col selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Header */}
      <Header
        page={activePage}
        setPage={handleSetPage}
        viewMode={viewMode}
        setViewMode={setViewMode}
        onRefresh={() => {
          loadAllTickers();
          load30dStats();
          loadActiveTokenData();
          loadMultiCandles(compareTimeframe);
        }}
        binanceConnected={binanceConnected}
        bybitConnected={bybitConnected}
        hyperliquidConnected={hyperliquidConnected}
        activeExchangeCount={activePage === 'solana' ? 1 : activePage === 'hyperliquid' ? 2 : 3}
        showRotation={showRotationScanner}
        onToggleRotation={() => setShowRotationScanner(!showRotationScanner)}
        showTable={showMarketTable}
        onToggleTable={() => setShowMarketTable(!showMarketTable)}
      />

      {/* Horizontal Ticker Carousel (Exclusively 5 Solana tokens on Solana page, 7 on Global page) */}
      <TickerBar
        tokens={currentTokens}
        tickers={tickers}
        selectedTokenId={selectedToken.id}
        onSelectToken={handleSelectToken}
      />

      {/* Main Body */}
      <main className="flex-1 flex flex-col">
        {viewMode === 'focus' ? (
          <div className="flex-1 grid grid-cols-1 xl:grid-cols-4 border-b border-slate-800">
            {/* Chart & Controls Column (Spans full 4 cols if order book is hidden, else 3 cols) */}
            <div
              className={`flex flex-col border-b xl:border-b-0 ${
                showOrderBook ? 'xl:col-span-3 xl:border-r border-slate-800' : 'xl:col-span-4 w-full'
              }`}
            >
              {/* Token Stats Header */}
              <TokenStats
                token={selectedToken}
                ticker={tickers[selectedToken.symbol]}
              />

              {/* Chart Controls Bar with Order Book toggle */}
              <ChartControls
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
                showOrderBook={showOrderBook}
                setShowOrderBook={setShowOrderBook}
              />

              {/* Chart Canvas */}
              <div className="flex-1 min-h-[540px] relative">
                {isLoadingCandles && candles.length === 0 ? (
                  <div className="absolute inset-0 z-30 bg-[#0b0e14]/80 flex flex-col items-center justify-center gap-3">
                    <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm font-mono text-slate-300">
                      Loading market candles for {selectedToken.symbol}...
                    </span>
                  </div>
                ) : null}

                <ChartContainer
                  token={selectedToken}
                  data={candles}
                  chartType={chartType}
                  showMA={showMA}
                  showBollinger={showBollinger}
                  showVolume={showVolume}
                  latestCandle={latestCandle}
                />
              </div>
            </div>

            {/* Right Column: Trades & Orderbook (Toggleable) */}
            {showOrderBook && (
              <div className="xl:col-span-1 min-h-[500px] flex flex-col">
                <OrderBookTrades
                  token={selectedToken}
                  trades={trades}
                  orderBook={orderBook}
                  onClose={() => setShowOrderBook(false)}
                />
              </div>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          /* Multi-Chart Grid View */
          <div className="flex-1">
            <MultiChartView
              tokens={currentTokens}
              tickers={tickers}
              multiCandles={multiCandles}
              onSelectToken={handleSelectToken}
            />
          </div>
        ) : (
          /* Multi-Asset Performance % Comparison Chart (Gain / Loss) */
          <div className="flex-1">
            <ComparePerformanceChart
              tokens={currentTokens}
              multiCandles={multiCandles}
              timeframe={compareTimeframe}
              onTimeframeChange={handleCompareTimeframeChange}
              onSelectToken={handleSelectToken}
            />
          </div>
        )}

        {/* Dedicated Solana Hub Section (Displayed ONLY on Solana page) */}
        {activePage === 'solana' && (
          <SolanaEcosystemSection
            tokens={SOLANA_TOKENS}
            tickers={tickers}
            stats30dMap={stats30dMap}
            onSelectToken={handleSelectToken}
          />
        )}

        {/* Dedicated Hyperliquid Hub Section (Displayed ONLY on Hyperliquid page) */}
        {activePage === 'hyperliquid' && (
          <HyperliquidEcosystemSection
            tokens={HYPERLIQUID_TOKENS}
            tickers={tickers}
            stats30dMap={stats30dMap}
            onSelectToken={handleSelectToken}
          />
        )}

        {/* Rotation & Arbitrage Swap Scanner (Intra-Solana on Solana page, Intra-Hyperliquid on Hyperliquid page, Intra-Global on Global page) */}
        {showRotationScanner && (
          <RotationSwapScanner
            tokens={currentTokens}
            tickers={tickers}
            onSelectToken={handleSelectToken}
          />
        )}

        {/* 24-Hour Market Overview Table (5 tokens on Solana page, 5 tokens on Hyperliquid page, 7 tokens on Global page) */}
        {showMarketTable && (
          <MarketTable24h
            tokens={currentTokens}
            tickers={tickers}
            stats30dMap={stats30dMap}
            onSelectToken={handleSelectToken}
          />
        )}
      </main>

      {/* Footer bar */}
      <footer className="bg-[#0b0e14] border-t border-slate-800/80 px-4 py-2.5 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>Real-time feeds connected: Binance Spot REST/WS, Bybit Spot/V5, and Hyperliquid L1 API/WS</span>
        </div>
        <div className="flex items-center gap-4 text-slate-400 flex-wrap">
          {activePage === 'solana' ? (
            <span className="text-emerald-400 font-semibold">
              Page Dédiée 100% Solana : SOL • JUP • MET • JTO • PUMP (Binance Feed)
            </span>
          ) : activePage === 'hyperliquid' ? (
            <span className="text-teal-400 font-semibold">
              Page Dédiée 100% Hyperliquid : HYPE • PURR • HFUN • HYPER • JEFF (Hyperliquid L1 + Binance)
            </span>
          ) : (
            <>
              <span>Binance: Sui • SOL • Zcash • Pengu • HYPE • HYPER</span>
              <span>•</span>
              <span>Bybit: Monad</span>
            </>
          )}
        </div>
      </footer>
    </div>
  );
};

export default App;
