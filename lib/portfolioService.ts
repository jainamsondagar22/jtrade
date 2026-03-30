import { db } from "@/firebase";
import {
  doc, getDoc, setDoc, updateDoc, arrayUnion
} from "firebase/firestore";

export interface Position {
  symbol: string;
  name: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
}

export interface Trade {
  id: string;
  symbol: string;
  type: "BUY" | "SELL";
  quantity: number;
  price: number;
  fee: number;
  total: number;
  timestamp: string;
}

export interface Portfolio {
  cash: number;
  positions: Position[];
  trades: Trade[];
  totalDeposited: number;
}

const TRANSACTION_FEE_RATE = 0.001;
const STARTING_CASH = 100000;


export async function initPortfolio(uid: string) {
  const ref = doc(db, "portfolios", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      cash: STARTING_CASH,
      positions: [],
      trades: [],
      totalDeposited: STARTING_CASH,
    });
  }
}


export async function getPortfolio(uid: string): Promise<Portfolio | null> {
  const ref = doc(db, "portfolios", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data() as Portfolio;
  return null;
}


export async function buyStock(
  uid: string,
  symbol: string,
  name: string,
  quantity: number,
  price: number
) {
  const ref = doc(db, "portfolios", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { success: false, message: "Portfolio not found" };

  const portfolio = snap.data() as Portfolio;
  const fee = price * quantity * TRANSACTION_FEE_RATE;
  const total = price * quantity + fee;

  if (portfolio.cash < total) {
    return { success: false, message: "Insufficient funds" };
  }

  
  const existing = portfolio.positions.find((p) => p.symbol === symbol);
  let updatedPositions: Position[];

  if (existing) {
    
    const newQty = existing.quantity + quantity;
    const newAvgCost = (existing.avgCost * existing.quantity + price * quantity) / newQty;
    updatedPositions = portfolio.positions.map((p) =>
      p.symbol === symbol
        ? { ...p, quantity: newQty, avgCost: newAvgCost, currentPrice: price }
        : p
    );
  } else {
    updatedPositions = [
      ...portfolio.positions,
      { symbol, name, quantity, avgCost: price, currentPrice: price },
    ];
  }

  const trade: Trade = {
    id: Date.now().toString(),
    symbol,
    type: "BUY",
    quantity,
    price,
    fee: parseFloat(fee.toFixed(2)),
    total: parseFloat(total.toFixed(2)),
    timestamp: new Date().toISOString(),
  };

  await updateDoc(ref, {
    cash: parseFloat((portfolio.cash - total).toFixed(2)),
    positions: updatedPositions,
    trades: arrayUnion(trade),
  });

  return { success: true, message: `Bought ${quantity} shares of ${symbol}` };
}


export async function sellStock(
  uid: string,
  symbol: string,
  quantity: number,
  price: number
) {
  const ref = doc(db, "portfolios", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { success: false, message: "Portfolio not found" };

  const portfolio = snap.data() as Portfolio;
  const position = portfolio.positions.find((p) => p.symbol === symbol);

  if (!position) return { success: false, message: "You do not own this stock" };
  if (position.quantity < quantity) return { success: false, message: "Not enough shares" };

  const fee = price * quantity * TRANSACTION_FEE_RATE;
  const proceeds = price * quantity - fee;

  let updatedPositions: Position[];
  if (position.quantity === quantity) {
    // Sold all shares — remove position entirely
    updatedPositions = portfolio.positions.filter((p) => p.symbol !== symbol);
  } else {
    updatedPositions = portfolio.positions.map((p) =>
      p.symbol === symbol ? { ...p, quantity: p.quantity - quantity, currentPrice: price } : p
    );
  }

  const trade: Trade = {
    id: Date.now().toString(),
    symbol,
    type: "SELL",
    quantity,
    price,
    fee: parseFloat(fee.toFixed(2)),
    total: parseFloat(proceeds.toFixed(2)),
    timestamp: new Date().toISOString(),
  };

  await updateDoc(ref, {
    cash: parseFloat((portfolio.cash + proceeds).toFixed(2)),
    positions: updatedPositions,
    trades: arrayUnion(trade),
  });

  return { success: true, message: `Sold ${quantity} shares of ${symbol}` };
}


export async function updatePrices(
  uid: string,
  prices: Record<string, number>
) {
  const ref = doc(db, "portfolios", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const portfolio = snap.data() as Portfolio;
  const updatedPositions = portfolio.positions.map((p) =>
    prices[p.symbol] ? { ...p, currentPrice: prices[p.symbol] } : p
  );

  await updateDoc(ref, { positions: updatedPositions });
}


export function calcPortfolioValue(portfolio: Portfolio): number {
  const holdingsValue = portfolio.positions.reduce(
    (sum, p) => sum + p.currentPrice * p.quantity, 0
  );
  return parseFloat((portfolio.cash + holdingsValue).toFixed(2));
}


export function calcUnrealizedPnL(position: Position): number {
  return parseFloat(
    ((position.currentPrice - position.avgCost) * position.quantity).toFixed(2)
  );
}


export function calcTotalUnrealizedPnL(portfolio: Portfolio): number {
  return parseFloat(
    portfolio.positions
      .reduce((sum, p) => sum + calcUnrealizedPnL(p), 0)
      .toFixed(2)
  );
}