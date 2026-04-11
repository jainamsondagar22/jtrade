"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import TopNav from "@/components/TopNav";
import {
  AssetConfig, ChartType, OHLC, DataPoint,
  DEFAULT_ASSETS, ASSET_SEEDS,
  generateOHLC, generateLineData,
} from "@/lib/assetData";

interface AssetDataStore {
  ohlc: OHLC[];
  line: DataPoint[];
}

const POINTS = 60;
const REFRESH_MS = 2000;

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function drawChart(
  canvas: HTMLCanvasElement,
  assets: AssetConfig[],
  dataStore: Record<string, AssetDataStore>
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  const PAD = { top: 24, right: 80, bottom: 48, left: 72 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;

  // White theme canvas background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);

  const visible = assets.filter((a) => a.visible);
  if (visible.length === 0) return;

  let globalMin = Infinity;
  let globalMax = -Infinity;

  visible.forEach((asset) => {
    const store = dataStore[asset.id];
    if (!store) return;
    if (asset.chartType === "candlestick") {
      store.ohlc.forEach((c) => {
        globalMin = Math.min(globalMin, c.low);
        globalMax = Math.max(globalMax, c.high);
      });
    } else {
      store.line.forEach((p) => {
        globalMin = Math.min(globalMin, p.value);
        globalMax = Math.max(globalMax, p.value);
      });
    }
  });

  const range = globalMax - globalMin || 1;
  const toY = (v: number) => PAD.top + cH - ((v - globalMin) / range) * cH;
  const toX = (i: number, total: number) => PAD.left + (i / (total - 1)) * cW;

  // Grid lines
  ctx.strokeStyle = "rgba(0,0,0,0.05)";
  ctx.lineWidth = 1;
  for (let g = 0; g <= 5; g++) {
    const y = PAD.top + (g / 5) * cH;
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(PAD.left + cW, y);
    ctx.stroke();
    const val = globalMax - (g / 5) * range;
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.font = "11px monospace";
    ctx.textAlign = "right";
    ctx.fillText(val.toFixed(val > 1000 ? 0 : 2), PAD.left - 8, y + 4);
  }

  const firstAsset = visible[0];
  const times =
    firstAsset.chartType === "candlestick"
      ? dataStore[firstAsset.id]?.ohlc.map((c) => c.time)
      : dataStore[firstAsset.id]?.line.map((p) => p.time);

  if (times) {
    [0, 0.25, 0.5, 0.75, 1].forEach((frac) => {
      const idx = Math.floor(frac * (times.length - 1));
      const x = toX(idx, times.length);
      const label = new Date(times[idx]).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.font = "11px monospace";
      ctx.textAlign = "center";
      ctx.fillText(label, x, H - 12);
    });
  }

  visible.forEach((asset) => {
    const store = dataStore[asset.id];
    if (!store) return;

    if (asset.chartType === "candlestick") {
      const data = store.ohlc;
      const candleW = Math.max(2, cW / data.length - 2);
      data.forEach((candle, i) => {
        const x = toX(i, data.length);
        const isUp = candle.close >= candle.open;
        const color = isUp ? "#10B981" : "#EF4444";
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, toY(candle.high));
        ctx.lineTo(x, toY(candle.low));
        ctx.stroke();
        const bodyTop = toY(Math.max(candle.open, candle.close));
        const bodyBot = toY(Math.min(candle.open, candle.close));
        ctx.fillStyle = color;
        ctx.fillRect(x - candleW / 2, bodyTop, candleW, Math.max(1, bodyBot - bodyTop));
      });

    } else if (asset.chartType === "line") {
      const data = store.line;
      const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + cH);
      grad.addColorStop(0, hexToRgba(asset.color, 0.15));
      grad.addColorStop(1, hexToRgba(asset.color, 0));
      ctx.beginPath();
      data.forEach((p, i) => {
        i === 0 ? ctx.moveTo(toX(i, data.length), toY(p.value)) : ctx.lineTo(toX(i, data.length), toY(p.value));
      });
      ctx.lineTo(toX(data.length - 1, data.length), PAD.top + cH);
      ctx.lineTo(PAD.left, PAD.top + cH);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.beginPath();
      ctx.strokeStyle = asset.color;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = "round";
      data.forEach((p, i) => {
        i === 0 ? ctx.moveTo(toX(i, data.length), toY(p.value)) : ctx.lineTo(toX(i, data.length), toY(p.value));
      });
      ctx.stroke();
      const last = data[data.length - 1];
      ctx.beginPath();
      ctx.arc(toX(data.length - 1, data.length), toY(last.value), 4.5, 0, Math.PI * 2);
      ctx.fillStyle = asset.color;
      ctx.fill();

    } else if (asset.chartType === "bar") {
      const data = store.line;
      const barW = Math.max(2, cW / data.length - 2);
      const baseline = PAD.top + cH;
      data.forEach((p, i) => {
        const x = toX(i, data.length);
        const y = toY(p.value);
        ctx.fillStyle = hexToRgba(asset.color, 0.85);
        ctx.fillRect(x - barW / 2, y, barW, baseline - y);
      });
    }
  });

  visible.forEach((asset) => {
    const store = dataStore[asset.id];
    if (!store) return;
    const last =
      asset.chartType === "candlestick"
        ? store.ohlc[store.ohlc.length - 1]?.close
        : store.line[store.line.length - 1]?.value;
    if (last === undefined) return;
    ctx.fillStyle = asset.color;
    ctx.font = "bold 11px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(
      last > 1000 ? last.toFixed(0) : last.toFixed(2),
      PAD.left + cW + 6,
      toY(last) + 4
    );
  });
}

function AssetRow({
  asset, data, onToggle, onChartType,
}: {
  asset: AssetConfig;
  data?: AssetDataStore;
  onToggle: (id: string) => void;
  onChartType: (id: string, type: ChartType) => void;
}) {
  const last = data
    ? asset.chartType === "candlestick"
      ? data.ohlc[data.ohlc.length - 1]?.close
      : data.line[data.line.length - 1]?.value
    : undefined;
  const prev = data
    ? asset.chartType === "candlestick"
      ? data.ohlc[data.ohlc.length - 2]?.close
      : data.line[data.line.length - 2]?.value
    : undefined;
  const pct =
    last !== undefined && prev !== undefined && prev !== 0
      ? (((last - prev) / prev) * 100).toFixed(2)
      : null;
  const up = pct !== null ? parseFloat(pct) >= 0 : true;

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all shadow-sm ${
      asset.visible ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50 opacity-60"
    }`}>
      <button
        onClick={() => onToggle(asset.id)}
        className="w-4 h-4 rounded-full flex-shrink-0 transition-all hover:scale-110 active:scale-95"
        style={{ backgroundColor: asset.visible ? asset.color : "transparent", border: `2px solid ${asset.color}` }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-gray-900 font-extrabold text-sm">{asset.symbol}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold tracking-widest ${
            asset.type === "crypto" ? "bg-amber-100 text-amber-700"
            : asset.type === "bond" ? "bg-red-100 text-red-700"
            : "bg-blue-100 text-blue-700"
          }`}>
            {asset.type.toUpperCase()}
          </span>
        </div>
        <div className="text-gray-500 text-xs font-medium truncate">{asset.name}</div>
      </div>
      <div className="text-right mr-2">
        {last !== undefined && (
          <>
            <div className="text-gray-900 text-sm font-mono font-bold">
              {last > 1000 ? last.toLocaleString(undefined, { maximumFractionDigits: 0 }) : last.toFixed(2)}
            </div>
            {pct && (
              <div className={`text-xs font-mono font-semibold ${up ? "text-emerald-600" : "text-red-500"}`}>
                {up ? "▲" : "▼"} {Math.abs(parseFloat(pct))}%
              </div>
            )}
          </>
        )}
      </div>
      <div className="flex gap-1">
        {(["line", "bar", "candlestick"] as ChartType[]).map((t) => (
          <button
            key={t}
            onClick={() => onChartType(asset.id, t)}
            className="text-[10px] px-2 py-1 rounded-md font-bold transition-all hover:bg-gray-100"
            style={asset.chartType === t
              ? { backgroundColor: asset.color + "22", color: asset.color }
              : { color: "rgba(0,0,0,0.3)" }
            }
          >
            {t === "line" ? "LINE" : t === "bar" ? "BAR" : "OHLC"}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ChartsPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [assets, setAssets] = useState<AssetConfig[]>(DEFAULT_ASSETS);
  const [dataStore, setDataStore] = useState<Record<string, AssetDataStore>>({});
  const [tick, setTick] = useState(0);
  const [isLive, setIsLive] = useState(true);

  useEffect(() => {
    const initial: Record<string, AssetDataStore> = {};
    DEFAULT_ASSETS.forEach((asset) => {
      const seed = ASSET_SEEDS[asset.id];
      initial[asset.id] = {
        ohlc: generateOHLC(seed.price, POINTS, seed.volatility, seed.trend),
        line: generateLineData(seed.price, POINTS, seed.volatility, seed.trend),
      };
    });
    setDataStore(initial);
  }, []);

  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      setDataStore((prev) => {
        const next = { ...prev };
        DEFAULT_ASSETS.forEach((asset) => {
          const store = prev[asset.id];
          if (!store) return;
          const seed = ASSET_SEEDS[asset.id];
          const lastClose = store.ohlc[store.ohlc.length - 1]?.close ?? seed.price;
          const newOHLC = generateOHLC(lastClose, 1, seed.volatility, seed.trend)[0];
          const newLine = generateLineData(lastClose, 1, seed.volatility, seed.trend)[0];
          next[asset.id] = {
            ohlc: [...store.ohlc.slice(1), { ...newOHLC, time: new Date().toISOString() }],
            line: [...store.line.slice(1), { ...newLine, time: new Date().toISOString() }],
          };
        });
        return next;
      });
      setTick((t) => t + 1);
    }, REFRESH_MS);
    return () => clearInterval(interval);
  }, [isLive]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || Object.keys(dataStore).length === 0) return;
    drawChart(canvas, assets, dataStore);
  }, [assets, dataStore, tick]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      if (Object.keys(dataStore).length > 0) drawChart(canvas, assets, dataStore);
    });
    ro.observe(canvas.parentElement!);
    return () => ro.disconnect();
  }, [assets, dataStore]);

  const toggleAsset = useCallback((id: string) => {
    setAssets((prev) => prev.map((a) => (a.id === id ? { ...a, visible: !a.visible } : a)));
  }, []);

  const setChartType = useCallback((id: string, type: ChartType) => {
    setAssets((prev) => prev.map((a) => (a.id === id ? { ...a, chartType: type } : a)));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900 flex flex-col font-sans">
      <TopNav />
      
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-extrabold text-lg tracking-tight">Multi-Asset Chart</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-500 text-xs font-semibold">{assets.filter((a) => a.visible).length} asset(s) visible</span>
          <button
            onClick={() => setIsLive((v) => !v)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold border transition-all active:scale-95 ${
              isLive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-gray-200 bg-gray-50 text-gray-400"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isLive ? "bg-emerald-500 animate-pulse" : "bg-gray-300"}`} />
            {isLive ? "LIVE" : "PAUSED"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative p-6">
          <div className="w-full h-full rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-sm" style={{ minHeight: 420 }}>
            <canvas ref={canvasRef} className="w-full h-full" style={{ minHeight: 420 }} />
          </div>
          <div className="absolute bottom-10 right-10 text-gray-400 text-xs font-mono font-bold bg-white/80 px-2 py-1 rounded backdrop-blur-sm border border-gray-200">
            TICK #{tick.toString().padStart(4, "0")}
          </div>
        </div>

        <div className="w-80 flex-shrink-0 border-l border-gray-200 bg-white flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 bg-slate-50/50">
            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Available Assets</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {assets.map((asset) => (
              <AssetRow
                key={asset.id}
                asset={asset}
                data={dataStore[asset.id]}
                onToggle={toggleAsset}
                onChartType={setChartType}
              />
            ))}
          </div>
          <div className="p-5 border-t border-gray-100 bg-slate-50/50">
            <p className="text-gray-400 text-xs leading-relaxed font-medium">Click the colour dot to toggle visibility. Data stream refreshes every 2s.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
