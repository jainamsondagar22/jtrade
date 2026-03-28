export type ChartType = "line" | "bar" | "candlestick";

export interface AssetConfig {
  id: string;
  name: string;
  symbol: string;
  type: "stock" | "crypto" | "bond";
  color: string;
  chartType: ChartType;
  visible: boolean;
}

export interface OHLC {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface DataPoint {
  time: string;
  value: number;
}

function generatePriceSeries(
  startPrice: number,
  points: number,
  volatility: number,
  trend: number
): number[] {
  const prices: number[] = [startPrice];
  for (let i = 1; i < points; i++) {
    const change = (Math.random() - 0.5) * 2 * volatility + trend;
    const next = Math.max(prices[i - 1] * (1 + change / 100), 0.01);
    prices.push(parseFloat(next.toFixed(2)));
  }
  return prices;
}

export function generateOHLC(
  startPrice: number,
  points: number,
  volatility: number,
  trend: number,
  intervalMinutes = 30
): OHLC[] {
  const closes = generatePriceSeries(startPrice, points, volatility, trend);
  const now = new Date();
  return closes.map((close, i) => {
    const time = new Date(now.getTime() - (points - i) * intervalMinutes * 60000);
    const open = i === 0 ? startPrice : closes[i - 1];
    const swing = Math.abs(close - open) * (0.5 + Math.random());
    const high = parseFloat((Math.max(open, close) + swing * Math.random()).toFixed(2));
    const low = parseFloat((Math.min(open, close) - swing * Math.random()).toFixed(2));
    const volume = Math.floor(Math.random() * 1_000_000 + 100_000);
    return {
      time: time.toISOString(),
      open: parseFloat(open.toFixed(2)),
      high,
      low: Math.max(low, 0.01),
      close,
      volume,
    };
  });
}

export function generateLineData(
  startPrice: number,
  points: number,
  volatility: number,
  trend: number,
  intervalMinutes = 30
): DataPoint[] {
  const prices = generatePriceSeries(startPrice, points, volatility, trend);
  const now = new Date();
  return prices.map((value, i) => ({
    time: new Date(now.getTime() - (points - i) * intervalMinutes * 60000).toISOString(),
    value,
  }));
}

export const DEFAULT_ASSETS: AssetConfig[] = [
  { id: "aapl",  name: "Apple Inc.",      symbol: "AAPL",  type: "stock",  color: "#3B82F6", chartType: "line",        visible: true  },
  { id: "btc",   name: "Bitcoin",          symbol: "BTC",   type: "crypto", color: "#F59E0B", chartType: "candlestick", visible: true  },
  { id: "tsla",  name: "Tesla Inc.",       symbol: "TSLA",  type: "stock",  color: "#10B981", chartType: "line",        visible: true  },
  { id: "eth",   name: "Ethereum",         symbol: "ETH",   type: "crypto", color: "#8B5CF6", chartType: "bar",         visible: false },
  { id: "bond",  name: "US 10Y Treasury",  symbol: "TNX",   type: "bond",   color: "#EF4444", chartType: "line",        visible: false },
  { id: "googl", name: "Alphabet Inc.",    symbol: "GOOGL", type: "stock",  color: "#06B6D4", chartType: "line",        visible: false },
];

export const ASSET_SEEDS: Record<string, { price: number; volatility: number; trend: number }> = {
  aapl:  { price: 182,   volatility: 1.2, trend: 0.05  },
  btc:   { price: 43500, volatility: 3.5, trend: 0.08  },
  tsla:  { price: 248,   volatility: 2.8, trend: -0.02 },
  eth:   { price: 2350,  volatility: 3.0, trend: 0.06  },
  bond:  { price: 98.5,  volatility: 0.3, trend: -0.01 },
  googl: { price: 141,   volatility: 1.5, trend: 0.04  },
};