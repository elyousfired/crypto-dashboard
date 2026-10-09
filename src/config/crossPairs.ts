import type { TokenConfig, CandleData, TickerData, Stats30d } from '../types/crypto';
import { TOKENS } from './tokens';

export interface SyntheticPairConfig {
  id: string; // e.g. "sui_sol"
  baseToken: TokenConfig; // Token A (Numerator)
  quoteToken: TokenConfig; // Token B (Denominator)
  symbol: string; // "SUI/SOL"
  displaySymbol: string; // "SUI / SOL"
  category: 'vs-sol' | 'vs-hype' | 'vs-sui' | 'cross-alts';
  narrative: string;
  description: string;
  precision: number;
}

// 6 Core Tokens for Cross-Pair trading
export const CROSS_BASE_TOKEN_IDS = ['sol', 'sui', 'zec', 'mon', 'hype', 'pengu'] as const;

export const CROSS_TOKENS: TokenConfig[] = CROSS_BASE_TOKEN_IDS.map(
  (id) => TOKENS.find((t) => t.id === id)!
).filter(Boolean);

export const getTokenById = (id: string): TokenConfig => {
  return CROSS_TOKENS.find((t) => t.id === id) || CROSS_TOKENS[0];
};

// 15 Pre-Configured Strategic Cross-Pairs
export const SYNTHETIC_PAIRS: SyntheticPairConfig[] = [
  // 1. Group vs SOL (Solana Benchmark) - 5 Pairs
  {
    id: 'sui_sol',
    baseToken: getTokenById('sui'),
    quoteToken: getTokenById('sol'),
    symbol: 'SUI/SOL',
    displaySymbol: 'SUI / SOL',
    category: 'vs-sol',
    narrative: 'L1 Speed Duel: Move vs Rust Solana',
    description: 'Mesure la performance relative du Layer 1 Sui face au benchmark de vitesse Solana.',
    precision: 5,
  },
  {
    id: 'hype_sol',
    baseToken: getTokenById('hype'),
    quoteToken: getTokenById('sol'),
    symbol: 'HYPE/SOL',
    displaySymbol: 'HYPE / SOL',
    category: 'vs-sol',
    narrative: 'Perps & HyperEVM vs Solana Hub',
    description: 'Compare le nouveau géant des perps décentralisés Hyperliquid face à Solana.',
    precision: 4,
  },
  {
    id: 'mon_sol',
    baseToken: getTokenById('mon'),
    quoteToken: getTokenById('sol'),
    symbol: 'MON/SOL',
    displaySymbol: 'MON / SOL',
    category: 'vs-sol',
    narrative: 'Parallel EVM vs Solana Architecture',
    description: 'Le duel d’exécution haute performance : Monad 10k TPS contre Solana.',
    precision: 5,
  },
  {
    id: 'pengu_sol',
    baseToken: getTokenById('pengu'),
    quoteToken: getTokenById('sol'),
    symbol: 'PENGU/SOL',
    displaySymbol: 'PENGU / SOL',
    category: 'vs-sol',
    narrative: 'Global Brand & IP vs Solana L1',
    description: 'Performance de Pudgy Penguins (Consumer IP) libellée en valeur SOL.',
    precision: 7,
  },
  {
    id: 'zec_sol',
    baseToken: getTokenById('zec'),
    quoteToken: getTokenById('sol'),
    symbol: 'ZEC/SOL',
    displaySymbol: 'ZEC / SOL',
    category: 'vs-sol',
    narrative: 'Privacy Pioneer vs High-Throughput L1',
    description: 'Zcash (Shielded privacy historique) comparé au leader de liquidité Solana.',
    precision: 4,
  },

  // 2. Group vs HYPE (Hyperliquid Benchmark) - 4 Pairs
  {
    id: 'sui_hype',
    baseToken: getTokenById('sui'),
    quoteToken: getTokenById('hype'),
    symbol: 'SUI/HYPE',
    displaySymbol: 'SUI / HYPE',
    category: 'vs-hype',
    narrative: 'Move Object Model vs HyperEVM L1',
    description: 'Arbitrage entre deux des infrastructures L1 les plus prometteuses du cycle.',
    precision: 4,
  },
  {
    id: 'mon_hype',
    baseToken: getTokenById('mon'),
    quoteToken: getTokenById('hype'),
    symbol: 'MON/HYPE',
    displaySymbol: 'MON / HYPE',
    category: 'vs-hype',
    narrative: 'Battle of the Next-Gen Execution Kings',
    description: 'Monad Parallel EVM contre Hyperliquid L1 — Les 2 favoris des traders.',
    precision: 4,
  },
  {
    id: 'pengu_hype',
    baseToken: getTokenById('pengu'),
    quoteToken: getTokenById('hype'),
    symbol: 'PENGU/HYPE',
    displaySymbol: 'PENGU / HYPE',
    category: 'vs-hype',
    narrative: 'NFT Consumer IP vs Perps Engine',
    description: 'Ratio de valeur entre Pengu et Hyperliquid.',
    precision: 6,
  },
  {
    id: 'zec_hype',
    baseToken: getTokenById('zec'),
    quoteToken: getTokenById('hype'),
    symbol: 'ZEC/HYPE',
    displaySymbol: 'ZEC / HYPE',
    category: 'vs-hype',
    narrative: 'OG Privacy vs DeFi 2.0 Orderbook',
    description: 'Évolution de Zcash contre l’essor de Hyperliquid.',
    precision: 4,
  },

  // 3. Group vs SUI (Sui Benchmark) - 3 Pairs
  {
    id: 'mon_sui',
    baseToken: getTokenById('mon'),
    quoteToken: getTokenById('sui'),
    symbol: 'MON/SUI',
    displaySymbol: 'MON / SUI',
    category: 'vs-sui',
    narrative: 'Parallel EVM vs Move Ecosystem',
    description: 'Le choc direct entre l’écosystème Monad et le Move de Sui.',
    precision: 4,
  },
  {
    id: 'pengu_sui',
    baseToken: getTokenById('pengu'),
    quoteToken: getTokenById('sui'),
    symbol: 'PENGU/SUI',
    displaySymbol: 'PENGU / SUI',
    category: 'vs-sui',
    narrative: 'Consumer Web3 IP vs Sui Network',
    description: 'Pengu valorisé en jetons Sui.',
    precision: 6,
  },
  {
    id: 'zec_sui',
    baseToken: getTokenById('zec'),
    quoteToken: getTokenById('sui'),
    symbol: 'ZEC/SUI',
    displaySymbol: 'ZEC / SUI',
    category: 'vs-sui',
    narrative: 'Confidentiality vs Scalability',
    description: 'Zcash contre la rapidité de Sui.',
    precision: 4,
  },

  // 4. Group Cross-Alts - 3 Pairs
  {
    id: 'mon_pengu',
    baseToken: getTokenById('mon'),
    quoteToken: getTokenById('pengu'),
    symbol: 'MON/PENGU',
    displaySymbol: 'MON / PENGU',
    category: 'cross-alts',
    narrative: 'High-Tech Infra vs Viral Community IP',
    description: 'La technologie Monad comparée au token de la culture Pengu.',
    precision: 2,
  },
  {
    id: 'mon_zec',
    baseToken: getTokenById('mon'),
    quoteToken: getTokenById('zec'),
    symbol: 'MON/ZEC',
    displaySymbol: 'MON / ZEC',
    category: 'cross-alts',
    narrative: 'New Wave Parallel EVM vs Veteran Privacy',
    description: 'Monad contre Zcash.',
    precision: 4,
  },
  {
    id: 'pengu_zec',
    baseToken: getTokenById('pengu'),
    quoteToken: getTokenById('zec'),
    symbol: 'PENGU/ZEC',
    displaySymbol: 'PENGU / ZEC',
    category: 'cross-alts',
    narrative: 'Culture / Memes vs ZK Shielded Money',
    description: 'Pengu contre Zcash.',
    precision: 6,
  },
];

// Helper: Calculate precision for any pair
export const getDynamicPrecision = (ratio: number): number => {
  if (ratio <= 0) return 4;
  if (ratio < 0.0001) return 8;
  if (ratio < 0.01) return 6;
  if (ratio < 1) return 5;
  if (ratio < 100) return 4;
  return 2;
};

// Helper: Build a Synthetic Pair Config on the fly
export const buildSyntheticPair = (baseToken: TokenConfig, quoteToken: TokenConfig): SyntheticPairConfig => {
  const existing = SYNTHETIC_PAIRS.find(
    (p) => p.baseToken.id === baseToken.id && p.quoteToken.id === quoteToken.id
  );
  if (existing) return existing;

  const reversed = SYNTHETIC_PAIRS.find(
    (p) => p.baseToken.id === quoteToken.id && p.quoteToken.id === baseToken.id
  );

  return {
    id: `${baseToken.id}_${quoteToken.id}`,
    baseToken,
    quoteToken,
    symbol: `${baseToken.baseAsset}/${quoteToken.baseAsset}`,
    displaySymbol: `${baseToken.baseAsset} / ${quoteToken.baseAsset}`,
    category: quoteToken.id === 'sol' ? 'vs-sol' : quoteToken.id === 'hype' ? 'vs-hype' : quoteToken.id === 'sui' ? 'vs-sui' : 'cross-alts',
    narrative: reversed ? `Inverse de ${reversed.symbol} (${reversed.narrative})` : `Duel ${baseToken.baseAsset} vs ${quoteToken.baseAsset}`,
    description: `Ratio synthétique ${baseToken.baseAsset}/${quoteToken.baseAsset}`,
    precision: 5,
  };
};

// Helper: Calculate Synthetic Candles from two CandleData arrays
export const calculateSyntheticCandles = (
  candlesA: CandleData[],
  candlesB: CandleData[]
): CandleData[] => {
  if (!candlesA.length || !candlesB.length) return [];

  // Create timestamp indexed map for candlesB
  const mapB = new Map<number, CandleData>();
  candlesB.forEach((c) => {
    mapB.set(c.time, c);
  });

  const result: CandleData[] = [];

  candlesA.forEach((cA) => {
    // Look up matching candle in B
    let cB = mapB.get(cA.time);

    // If exact timestamp not found, look for closest within small delta (e.g. 60s)
    if (!cB) {
      for (const [t, candidate] of mapB.entries()) {
        if (Math.abs(t - cA.time) < 60) {
          cB = candidate;
          break;
        }
      }
    }

    if (cB && cB.open > 0 && cB.close > 0 && cB.high > 0 && cB.low > 0) {
      const openRatio = cA.open / cB.open;
      const closeRatio = cA.close / cB.close;

      // Extreme bounds for the synthetic ratio:
      // Maximum ratio is achieved when A hits highest and B hits lowest
      const maxExt = cA.high / Math.max(cB.low, 0.0000001);
      // Minimum ratio is achieved when A hits lowest and B hits highest
      const minExt = cA.low / Math.max(cB.high, 0.0000001);

      const highRatio = Math.max(openRatio, closeRatio, maxExt);
      const lowRatio = Math.min(openRatio, closeRatio, minExt);

      // Volume: approximate USD volume
      const approxUsdVol = (cA.volume * cA.close) + (cB.volume * cB.close);

      result.push({
        time: cA.time,
        open: openRatio,
        high: highRatio,
        low: lowRatio,
        close: closeRatio,
        volume: approxUsdVol,
      });
    }
  });

  return result.sort((a, b) => a.time - b.time);
};

// Helper: Calculate live Synthetic Ticker from two TickerData objects
export const calculateSyntheticTicker = (
  tickerA?: TickerData,
  tickerB?: TickerData
) => {
  const priceA = tickerA?.lastPrice ?? 0;
  const priceB = tickerB?.lastPrice ?? 0;

  if (priceA <= 0 || priceB <= 0) {
    return {
      ratio: 0,
      change24hPercent: 0,
      high24h: 0,
      low24h: 0,
      leader: 'none',
      leaderStrength: 0,
    };
  }

  const currentRatio = priceA / priceB;

  // Exact 24h percentage return of the ratio:
  // Return(A/B) = (1 + rA) / (1 + rB) - 1
  const rA = (tickerA?.priceChangePercent ?? 0) / 100;
  const rB = (tickerB?.priceChangePercent ?? 0) / 100;
  const ratioChangePct = ((1 + rA) / (1 + rB) - 1) * 100;

  // Approximate 24h high/low bounds of the ratio
  const highA = tickerA?.highPrice ?? priceA;
  const lowA = tickerA?.lowPrice ?? priceA;
  const highB = tickerB?.highPrice ?? priceB;
  const lowB = tickerB?.lowPrice ?? priceB;

  const highRatio = highB > 0 && lowB > 0 ? Math.max(currentRatio, highA / lowB) : currentRatio;
  const lowRatio = highB > 0 && lowB > 0 ? Math.min(currentRatio, lowA / highB) : currentRatio;

  const leader = ratioChangePct > 0 ? 'base' : ratioChangePct < 0 ? 'quote' : 'neutral';
  const leaderStrength = Math.abs(ratioChangePct);

  return {
    ratio: currentRatio,
    change24hPercent: ratioChangePct,
    high24h: highRatio,
    low24h: lowRatio,
    leader,
    leaderStrength,
  };
};

// Helper: Calculate 30-Day Drawdown and Range for the Synthetic Pair
export const calculateSynthetic30dStats = (
  statA?: Stats30d,
  statB?: Stats30d,
  currentRatio: number = 0
): { high30d: number; low30d: number; dropFromHighPct: number; gainFromLowPct: number } => {
  if (!statA || !statB || statA.high30d <= 0 || statB.low30d <= 0 || currentRatio <= 0) {
    return {
      high30d: currentRatio,
      low30d: currentRatio,
      dropFromHighPct: 0,
      gainFromLowPct: 0,
    };
  }

  const high30d = statA.high30d / Math.max(statB.low30d, 0.0000001);
  const low30d = statA.low30d / Math.max(statB.high30d, 0.0000001);

  const dropFromHighPct = high30d > 0 ? ((currentRatio - high30d) / high30d) * 100 : 0;
  const gainFromLowPct = low30d > 0 ? ((currentRatio - low30d) / low30d) * 100 : 0;

  return {
    high30d,
    low30d,
    dropFromHighPct,
    gainFromLowPct,
  };
};
