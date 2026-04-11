"use client";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { auth } from "@/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getUserData, updateWatchlist } from "@/lib/userService";
import Link from "next/link";
import TopNav from "@/components/TopNav";

export default function Dashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [newStock, setNewStock] = useState("");

  // Load user data when page opens
  useEffect(() => {
    if (user) {
      getUserData(user.uid).then((data) => {
        if (data) setWatchlist(data.watchlist || []);
      });
    }
  }, [user]);

  // handles adding a new ticker symbol to the user's watchlist
  async function handleAddStock() {
    if (!newStock.trim() || !user) return;
    const nextWatchlist = [...watchlist, newStock.toUpperCase()]; // keep it uppercase for consistency
    setWatchlist(nextWatchlist);
    await updateWatchlist(user.uid, nextWatchlist);
    setNewStock("");
  }

  // removes a stock
  async function handleRemoveStock(stockTicker: string) {
    if (!user) return;
    const filteredList = watchlist.filter((s) => s !== stockTicker);
    setWatchlist(filteredList);
    await updateWatchlist(user.uid, filteredList);
  }

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/auth");
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        {/* Top Navbar matching the Auth layout */}
        <TopNav />

        {/* Main Dashboard Content */}
        <div className="flex-1 p-8 items-center flex flex-col">
          <div className="w-full max-w-[800px] bg-white border border-gray-200 rounded-2xl shadow-sm p-8 sm:p-10">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mb-2">Dashboard</h1>
            <p className="text-gray-500 text-sm mb-8">
              Logged in as <span className="font-semibold text-gray-700">{user?.email}</span>
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Watchlist Section */}
              <div className="space-y-4">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-widest border-b border-gray-100 pb-2">Your Watchlist</h2>
                
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newStock}
                    onChange={(e) => setNewStock(e.target.value)}
                    placeholder="Add stock (e.g. AAPL)"
                    className="flex-1 bg-slate-50 border border-gray-200 text-gray-900 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 transition-all placeholder:text-gray-400 uppercase"
                  />
                  <button
                    onClick={handleAddStock}
                    className="bg-gray-900 text-white font-medium rounded-lg px-5 hover:bg-gray-800 transition-all active:scale-95"
                  >
                    Add
                  </button>
                </div>

                <div className="bg-slate-50 border border-gray-200 rounded-lg min-h-[160px] p-2">
                  {watchlist.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-sm text-gray-400 py-10">
                      Your watchlist is empty
                    </div>
                  ) : (
                    <ul className="space-y-1">
                      {watchlist.map((tickerStr) => (
                        <li key={tickerStr} className="flex justify-between items-center p-3 rounded-md hover:bg-white border border-transparent hover:border-gray-200 transition-all group">
                          <span className="font-semibold text-gray-800">{tickerStr}</span>
                          <button
                            onClick={() => handleRemoveStock(tickerStr)}
                            className="text-xs font-semibold text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-700 uppercase"
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Quick Actions Area */}
              <div className="space-y-4">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-widest border-b border-gray-100 pb-2">Quick Actions</h2>
                <div className="grid gap-3">
                  <Link href="/charts" className="flex items-center p-4 border border-gray-200 rounded-xl hover:border-gray-400 hover:shadow-sm transition-all group">
                    <span className="font-semibold text-gray-800 text-sm group-hover:text-black">Open Multi-Asset Chart</span>
                    <svg className="ml-auto w-4 h-4 text-gray-400 group-hover:text-gray-900 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </Link>

                  <Link href="/portfolio" className="flex items-center p-4 border border-gray-200 rounded-xl hover:border-gray-400 hover:shadow-sm transition-all group">
                    <span className="font-semibold text-gray-800 text-sm group-hover:text-black">Portfolio Simulator</span>
                    <svg className="ml-auto w-4 h-4 text-gray-400 group-hover:text-gray-900 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </Link>
                  
                  <Link href="/patterns" className="flex items-center p-4 border border-gray-200 rounded-xl hover:border-gray-400 hover:shadow-sm transition-all group">
                    <span className="font-semibold text-gray-800 text-sm group-hover:text-black">Pattern Recognition</span>
                    <svg className="ml-auto w-4 h-4 text-gray-400 group-hover:text-gray-900 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </Link>

                  <Link href="/strategies" className="flex items-center p-4 border border-gray-200 rounded-xl hover:border-gray-400 hover:shadow-sm transition-all group">
                    <span className="font-semibold text-gray-800 text-sm group-hover:text-black">Strategy Builder</span>
                    <svg className="ml-auto w-4 h-4 text-gray-400 group-hover:text-gray-900 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </Link>

                  <Link href="/analytics" className="flex items-center p-4 border border-gray-200 rounded-xl hover:border-gray-400 hover:shadow-sm transition-all group">
                    <span className="font-semibold text-gray-800 text-sm group-hover:text-black">Analytics Dashboard</span>
                    <svg className="ml-auto w-4 h-4 text-gray-400 group-hover:text-gray-900 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </Link>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}