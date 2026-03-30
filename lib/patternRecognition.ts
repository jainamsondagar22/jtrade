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

// Main detection function — scans all candles and returns detected patterns
export function detectPatterns(candles: OHLC[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const prev = i > 0 ? candles[i - 1] : null;
    const prev2 = i > 1 ? candles[i - 2] : null;

    if (isDoji(c)) {
      patterns.push({ type: "Doji", index: i, ...PATTERN_INFO["Doji"] });
    } else if (isHammer(c)) {
      patterns.push({ type: "Hammer", index: i, ...PATTERN_INFO["Hammer"] });
    } else if (isShootingStar(c)) {
      patterns.push({ type: "Shooting Star", index: i, ...PATTERN_INFO["Shooting Star"] });
    }

    if (prev) {
      if (isBullishEngulfing(prev, c)) {
        patterns.push({ type: "Bullish Engulfing", index: i, ...PATTERN_INFO["Bullish Engulfing"] });
      } else if (isBearishEngulfing(prev, c)) {
        patterns.push({ type: "Bearish Engulfing", index: i, ...PATTERN_INFO["Bearish Engulfing"] });
      }
    }

    if (prev && prev2) {
      if (isMorningStar(prev2, prev, c)) {
        patterns.push({ type: "Morning Star", index: i, ...PATTERN_INFO["Morning Star"] });
      } else if (isEveningStar(prev2, prev, c)) {
        patterns.push({ type: "Evening Star", index: i, ...PATTERN_INFO["Evening Star"] });
      }
    }
  }

  return patterns;
}