// Technical indicator calculations for the strategy builder

export interface IndicatorPoint {
  index: number;
  value: number;
}

export interface BollingerPoint {
  index: number;
  upper: number;
  middle: number;
  lower: number;
}

export interface BacktestTrade {
  type: "BUY" | "SELL";
  index: number;
  price: number;
  reason: string;
}

export interface BacktestResult {
  trades: BacktestTrade[];
  finalValue: number;
  totalReturn: number;
  totalReturnPct: number;
  winRate: number;
  totalTrades: number;
}

// calculates simple moving avg (could be optimized if we have huge datasets, fine for now)
export function calcSMA(prices: number[], period: number): IndicatorPoint[] {
  const smas: IndicatorPoint[] = [];
  for (let i = period - 1; i < prices.length; i++) {
    const windowSlice = prices.slice(i - period + 1, i + 1);
    const sum = windowSlice.reduce((acc, val) => acc + val, 0);
    smas.push({ index: i, value: parseFloat((sum / period).toFixed(4)) });
  }
  return smas;
}

// EMA gives more weight to recent prices
export function calcEMA(prices: number[], period: number): IndicatorPoint[] {
  const emas: IndicatorPoint[] = [];
  const multiplier = 2 / (period + 1);
  
  // start with simple avg for the initial value
  let currentEma = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  emas.push({ index: period - 1, value: parseFloat(currentEma.toFixed(4)) });
  
  for (let idx = period; idx < prices.length; idx++) {
    currentEma = (prices[idx] - currentEma) * multiplier + currentEma; // standard formula
    emas.push({ index: idx, value: parseFloat(currentEma.toFixed(4)) });
  }
  return emas;
}

// Bollinger Bands — middle SMA with upper and lower bands at N standard deviations
export function calcBollingerBands(
  prices: number[],
  period = 20,
  stdDev = 2
): BollingerPoint[] {
  const result: BollingerPoint[] = [];
  for (let i = period - 1; i < prices.length; i++) {
    const slice = prices.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
    const sd = Math.sqrt(variance);
    result.push({
      index: i,
      middle: parseFloat(mean.toFixed(4)),
      upper: parseFloat((mean + stdDev * sd).toFixed(4)),
      lower: parseFloat((mean - stdDev * sd).toFixed(4)),
    });
  }
  return result;
}

// RSI - measures overbought/oversold conditions (0-100)
// Kinda messy but standard wilder's smoothing method
export function calcRSI(prices: number[], period = 14): IndicatorPoint[] {
  const rsiVals: IndicatorPoint[] = [];
  if (prices.length < period + 1) return rsiVals;

  // calc price diffs
  const diffs = prices.slice(1).map((p, idx) => p - prices[idx]);
  
  let gains = diffs.slice(0, period).filter((d) => d > 0);
  let losses = diffs.slice(0, period).filter((d) => d < 0).map(Math.abs);

  let avgGain = gains.reduce((sum, val) => sum + val, 0) / period;
  let avgLoss = losses.reduce((sum, val) => sum + val, 0) / period;

  const calculateRSIValue = (ag: number, al: number) => {
    if (al === 0) return 100;
    const rs = ag / al;
    return parseFloat((100 - 100 / (1 + rs)).toFixed(2));
  };

  rsiVals.push({ index: period, value: calculateRSIValue(avgGain, avgLoss) });

  for (let i = period; i < diffs.length; i++) {
    const currentGain = diffs[i] > 0 ? diffs[i] : 0;
    const currentLoss = diffs[i] < 0 ? Math.abs(diffs[i]) : 0;
    
    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;
    
    rsiVals.push({ index: i + 1, value: calculateRSIValue(avgGain, avgLoss) });
  }

  return rsiVals;
}

// Backtest engine — runs a strategy against price data and returns results
export function runBacktest(
  prices: number[],
  strategy: {
    indicator: "SMA" | "EMA" | "BB" | "RSI";
    buyCondition: string;
    sellCondition: string;
    period: number;
    rsiOverbought: number;
    rsiOversold: number;
    smaPeriod: number;
  }
): BacktestResult {
  const trades: BacktestTrade[] = [];
  let cash = 10000;
  let shares = 0;
  let wins = 0;
  let buyPrice = 0;

  const sma = calcSMA(prices, strategy.smaPeriod);
  const ema = calcEMA(prices, strategy.smaPeriod);
  const bb = calcBollingerBands(prices, strategy.period);
  const rsi = calcRSI(prices, strategy.period);

  const getSMA = (i: number) => sma.find((s) => s.index === i)?.value;
  const getEMA = (i: number) => ema.find((s) => s.index === i)?.value;
  const getBB = (i: number) => bb.find((b) => b.index === i);
  const getRSI = (i: number) => rsi.find((r) => r.index === i)?.value;

  for (let i = 1; i < prices.length; i++) {
    const price = prices[i];
    const prevPrice = prices[i - 1];

    let shouldBuy = false;
    let shouldSell = false;
    let buyReason = "";
    let sellReason = "";

    if (strategy.indicator === "SMA") {
      const smaVal = getSMA(i);
      const prevSMA = getSMA(i - 1);
      if (smaVal && prevSMA) {
        shouldBuy = prevPrice < prevSMA && price >= smaVal;
        shouldSell = prevPrice > prevSMA && price <= smaVal;
        buyReason = `Price crossed above SMA(${strategy.smaPeriod})`;
        sellReason = `Price crossed below SMA(${strategy.smaPeriod})`;
      }
    } else if (strategy.indicator === "EMA") {
      const emaVal = getEMA(i);
      const prevEMA = getEMA(i - 1);
      if (emaVal && prevEMA) {
        shouldBuy = prevPrice < prevEMA && price >= emaVal;
        shouldSell = prevPrice > prevEMA && price <= emaVal;
        buyReason = `Price crossed above EMA(${strategy.smaPeriod})`;
        sellReason = `Price crossed below EMA(${strategy.smaPeriod})`;
      }
    } else if (strategy.indicator === "BB") {
      const band = getBB(i);
      if (band) {
        shouldBuy = price <= band.lower;
        shouldSell = price >= band.upper;
        buyReason = `Price touched lower Bollinger Band`;
        sellReason = `Price touched upper Bollinger Band`;
      }
    } else if (strategy.indicator === "RSI") {
      const rsiVal = getRSI(i);
      const prevRSI = getRSI(i - 1);
      if (rsiVal && prevRSI) {
        shouldBuy = prevRSI <= strategy.rsiOversold && rsiVal > strategy.rsiOversold;
        shouldSell = prevRSI >= strategy.rsiOverbought && rsiVal < strategy.rsiOverbought;
        buyReason = `RSI crossed above ${strategy.rsiOversold} (oversold)`;
        sellReason = `RSI crossed below ${strategy.rsiOverbought} (overbought)`;
      }
    }

    if (shouldBuy && shares === 0 && cash >= price) {
      shares = Math.floor(cash / price);
      cash -= shares * price;
      buyPrice = price;
      trades.push({ type: "BUY", index: i, price, reason: buyReason });
    } else if (shouldSell && shares > 0) {
      cash += shares * price;
      if (price > buyPrice) wins++;
      shares = 0;
      trades.push({ type: "SELL", index: i, price, reason: sellReason });
    }
  }

  // Close any open position at last price
  if (shares > 0) {
    cash += shares * prices[prices.length - 1];
    if (prices[prices.length - 1] > buyPrice) wins++;
  }

  const totalReturn = cash - 10000;
  const sellTrades = trades.filter((t) => t.type === "SELL").length;

  return {
    trades,
    finalValue: parseFloat(cash.toFixed(2)),
    totalReturn: parseFloat(totalReturn.toFixed(2)),
    totalReturnPct: parseFloat(((totalReturn / 10000) * 100).toFixed(2)),
    winRate: sellTrades > 0 ? parseFloat(((wins / sellTrades) * 100).toFixed(1)) : 0,
    totalTrades: trades.length,
  };
}