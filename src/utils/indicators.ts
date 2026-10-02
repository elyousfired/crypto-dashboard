import type { CandleData } from '../types/crypto';

export interface IndicatorPoint {
  time: number;
  value: number;
}

export function calculateSMA(data: CandleData[], period: number): IndicatorPoint[] {
  const result: IndicatorPoint[] = [];
  if (data.length < period) return result;

  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    result.push({
      time: data[i].time,
      value: parseFloat((sum / period).toFixed(6)),
    });
  }

  return result;
}

export function calculateEMA(data: CandleData[], period: number): IndicatorPoint[] {
  const result: IndicatorPoint[] = [];
  if (data.length < period) return result;

  const multiplier = 2 / (period + 1);

  let initialSum = 0;
  for (let i = 0; i < period; i++) {
    initialSum += data[i].close;
  }
  let prevEMA = initialSum / period;
  result.push({ time: data[period - 1].time, value: parseFloat(prevEMA.toFixed(6)) });

  for (let i = period; i < data.length; i++) {
    const currentPrice = data[i].close;
    const currentEMA = (currentPrice - prevEMA) * multiplier + prevEMA;
    result.push({
      time: data[i].time,
      value: parseFloat(currentEMA.toFixed(6)),
    });
    prevEMA = currentEMA;
  }

  return result;
}

export function calculateBollingerBands(
  data: CandleData[],
  period: number = 20,
  stdDevMultiplier: number = 2
): {
  upper: IndicatorPoint[];
  middle: IndicatorPoint[];
  lower: IndicatorPoint[];
} {
  const upper: IndicatorPoint[] = [];
  const middle: IndicatorPoint[] = [];
  const lower: IndicatorPoint[] = [];

  if (data.length < period) return { upper, middle, lower };

  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    const mean = sum / period;

    let varianceSum = 0;
    for (let j = 0; j < period; j++) {
      varianceSum += Math.pow(data[i - j].close - mean, 2);
    }
    const stdDev = Math.sqrt(varianceSum / period);

    const time = data[i].time;
    middle.push({ time, value: parseFloat(mean.toFixed(6)) });
    upper.push({ time, value: parseFloat((mean + stdDevMultiplier * stdDev).toFixed(6)) });
    lower.push({ time, value: parseFloat((mean - stdDevMultiplier * stdDev).toFixed(6)) });
  }

  return { upper, middle, lower };
}
