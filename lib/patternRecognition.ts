import { OHLC } from "@/lib/assetData";

export type PatternType =
  | "Doji"
  | "Hammer"
  | "Shooting Star"
  | "Bullish Engulfing"
  | "Bearish Engulfing"
  | "Morning Star"
  | "Evening Star";

export interface DetectedPattern {
  type: PatternType;
  index: number;
  color: string;
  signal: "bullish" | "bearish" | "neutral";
  description: string;
}

const PATTERN_INFO: Record<PatternType, { color: string; signal: "bullish" | "bearish" | "neutral"; description: string }> = {
  "Doji": {
    color: "#F59E0B",
    signal: "neutral",
    description: "Open and close are nearly equal. Signals market indecision — a reversal may follow.",
  },
  "Hammer": {
    color: "#10B981",
    signal: "bullish",
    description: "Small body at top with long lower wick. Signals potential bullish reversal after a downtrend.",
  },
  "Shooting Star": {
    color: "#EF4444",
    signal: "bearish",
    description: "Small body at bottom with long upper wick. Signals potential bearish reversal after an uptrend.",
  },
  "Bullish Engulfing": {
    color: "#10B981",
    signal: "bullish",
    description: "Large green candle fully engulfs the previous red candle. Strong bullish reversal signal.",
  },
  "Bearish Engulfing": {
    color: "#EF4444",
    signal: "bearish",
    description: "Large red candle fully engulfs the previous green candle. Strong bearish reversal signal.",
  },
  "Morning Star": {
    color: "#10B981",
    signal: "bullish",
    description: "Three candle pattern: down candle, small indecision candle, up candle. Signals bullish reversal.",
  },
  "Evening Star": {
    color: "#EF4444",
    signal: "bearish",
    description: "Three candle pattern: up candle, small indecision candle, down candle. Signals bearish reversal.",
  },
};

// Helper — body size as percentage of total range
function bodyPct(c: OHLC): number {
  const range = c.high - c.low;
  if (range === 0) return 0;
  return Math.abs(c.close - c.open) / range;
}

// Helper — upper wick size
function upperWick(c: OHLC): number {
  return c.high - Math.max(c.open, c.close);
}

// Helper — lower wick size
function lowerWick(c: OHLC): number {
  return Math.min(c.open, c.close) - c.low;
}

// Helper — total range
function range(c: OHLC): number {
  return c.high - c.low;
}

function isDoji(c: OHLC): boolean {
  return bodyPct(c) < 0.1;
}

function isHammer(c: OHLC): boolean {
  const lw = lowerWick(c);
  const uw = upperWick(c);
  const body = Math.abs(c.close - c.open);
  return lw > body * 2 && uw < body * 0.5 && bodyPct(c) > 0.05;
}

function isShootingStar(c: OHLC): boolean {
  const uw = upperWick(c);
  const lw = lowerWick(c);
  const body = Math.abs(c.close - c.open);
  return uw > body * 2 && lw < body * 0.5 && bodyPct(c) > 0.05;
}

function isBullishEngulfing(prev: OHLC, curr: OHLC): boolean {
  const prevBearish = prev.close < prev.open;
  const currBullish = curr.close > curr.open;
  return (
    prevBearish &&
    currBullish &&
    curr.open < prev.close &&
    curr.close > prev.open
  );
}

function isBearishEngulfing(prev: OHLC, curr: OHLC): boolean {
  const prevBullish = prev.close > prev.open;
  const currBearish = curr.close < curr.open;
  return (
    prevBullish &&
    currBearish &&
    curr.open > prev.close &&
    curr.close < prev.open
  );
}

function isMorningStar(a: OHLC, b: OHLC, c: OHLC): boolean {
  const aBearish = a.close < a.open;
  const bSmall = bodyPct(b) < 0.2;
  const cBullish = c.close > c.open;
  return aBearish && bSmall && cBullish && c.close > (a.open + a.close) / 2;
}

function isEveningStar(a: OHLC, b: OHLC, c: OHLC): boolean {
  const aBullish = a.close > a.open;
  const bSmall = bodyPct(b) < 0.2;
  const cBearish = c.close < c.open;
  return aBullish && bSmall && cBearish && c.close < (a.open + a.close) / 2;
}

// Loops through the candles and spits out any registered patterns
export function detectPatterns(candles: OHLC[]): DetectedPattern[] {
  const foundPatterns: DetectedPattern[] = [];

  for (let idx = 0; idx < candles.length; idx++) {
    const current = candles[idx];
    const prev = idx > 0 ? candles[idx - 1] : null;
    const prevPrev = idx > 1 ? candles[idx - 2] : null;

    // Single candle rules
    if (isDoji(current)) {
      foundPatterns.push({ type: "Doji", index: idx, ...PATTERN_INFO["Doji"] });
    } else if (isHammer(current)) {
      foundPatterns.push({ type: "Hammer", index: idx, ...PATTERN_INFO["Hammer"] });
    } else if (isShootingStar(current)) {
      foundPatterns.push({ type: "Shooting Star", index: idx, ...PATTERN_INFO["Shooting Star"] });
    }

    // Two-candle rules
    if (prev) {
      if (isBullishEngulfing(prev, current)) {
        foundPatterns.push({ type: "Bullish Engulfing", index: idx, ...PATTERN_INFO["Bullish Engulfing"] });
      } else if (isBearishEngulfing(prev, current)) {
        foundPatterns.push({ type: "Bearish Engulfing", index: idx, ...PATTERN_INFO["Bearish Engulfing"] });
      }
    }

    // Three-candle rules
    if (prev && prevPrev) {
      if (isMorningStar(prevPrev, prev, current)) {
        foundPatterns.push({ type: "Morning Star", index: idx, ...PATTERN_INFO["Morning Star"] });
      } else if (isEveningStar(prevPrev, prev, current)) {
        foundPatterns.push({ type: "Evening Star", index: idx, ...PATTERN_INFO["Evening Star"] });
      }
    }
  }

  return foundPatterns;
}