"use client";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { auth } from "@/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getUserData, updateWatchlist } from "@/lib/userService";

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

  // Add stock to watchlist
  const addToWatchlist = async () => {
    if (!newStock.trim() || !user) return;
    const updated = [...watchlist, newStock.toUpperCase()];
    setWatchlist(updated);
    await updateWatchlist(user.uid, updated);
    setNewStock("");
  };

  // Remove stock from watchlist
  const removeFromWatchlist = async (stock: string) => {
    if (!user) return;
    const updated = watchlist.filter((s) => s !== stock);
    setWatchlist(updated);
    await updateWatchlist(user.uid, updated);
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/auth");
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-4xl mx-auto bg-white rounded shadow p-6">
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-gray-600 mb-6">Logged in as: <strong>{user?.email}</strong></p>

          {/* Watchlist Section */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-3">📋 My Watchlist</h2>
            <div className="flex gap-2 mb-4">
              <input
                className="border p-2 rounded w-full"
                placeholder="Add stock symbol e.g. AAPL"
                value={newStock}
                onChange={(e) => setNewStock(e.target.value)}
              />
              <button
                onClick={addToWatchlist}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Add
              </button>
            </div>
            {watchlist.length === 0 ? (
              <p className="text-gray-400">No stocks in watchlist yet.</p>
            ) : (
              <ul className="space-y-2">
                {watchlist.map((stock) => (
                  <li key={stock} className="flex justify-between items-center border p-2 rounded">
                    <span className="font-medium">{stock}</span>
                    <button
                      onClick={() => removeFromWatchlist(stock)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          
          <div className="mb-6">
  
    <a href="/charts"
    className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded transition"
  >
    📈 Open Multi-Asset Chart
  </a>
</div>

          <button
            onClick={handleLogout}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Logout
          </button>
        </div>
      </div>
    </ProtectedRoute>
  );
}