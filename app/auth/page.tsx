"use client";
import { useState } from "react";
import { auth, db } from "@/firebase";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoginState, setIsLoginState] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // keeping logic separate handles the different branches more cleanly 
  // than a single massive blob
  async function executeLogin() {
    try {
      setIsLoading(true);
      setStatusMessage("");
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/dashboard");
    } catch (err: any) {
      console.error(err);
      setStatusMessage(err.message || "Failed to log in.");
    } finally {
      setIsLoading(false);
    }
  }

  async function executeSignUp() {
    try {
      setIsLoading(true);
      setStatusMessage("");
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // build out the user profile on registration
      await setDoc(doc(db, "users", user.uid), {
        email: user.email,
        watchlist: [],
        portfolio: [],
        preferences: {},
        createdAt: new Date(),
      });
      
      router.push("/dashboard");
    } catch (err: any) {
      console.error(err);
      setStatusMessage(err.message || "Failed to create account.");
    } finally {
      setIsLoading(false);
    }
  }

  // main handler triggered by user click
  const handleSubmit = () => {
    if (!email || !password) {
      setStatusMessage("Please fill in both fields.");
      return;
    }
    isLoginState ? executeLogin() : executeSignUp();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Main Content */}
      <div className="flex-1 flex flex-col">

        {/* Auth Card Centered */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-[420px] bg-white border border-gray-200 rounded-2xl shadow-sm p-8 sm:p-10 relative">
            <div className="text-center">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mb-2">JTrade</h1>
              <p className="text-gray-500 text-sm mb-8">
                {isLoginState ? "Sign in to your account" : "Create a new account"}
              </p>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-slate-50 border border-gray-200 text-gray-900 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 transition-all placeholder:text-gray-400"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-gray-200 text-gray-900 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 transition-all placeholder:text-gray-400 font-mono tracking-widest"
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="w-full bg-gray-900 text-white font-medium rounded-lg px-4 py-3 mt-4 hover:bg-gray-800 active:scale-[0.99] transition-all disabled:opacity-70"
              >
                {isLoading ? "Processing..." : isLoginState ? "Sign in" : "Create Account"}
              </button>

              {statusMessage && (
                <p className="text-sm text-red-500 font-medium text-center pt-2">
                  {statusMessage}
                </p>
              )}
            </div>

            {/* Toggle bottom link */}
            <div className="mt-8 flex flex-col items-center">
              <span
                onClick={() => setIsLoginState(!isLoginState)}
                className="text-sm font-semibold text-gray-500 hover:text-gray-900 cursor-pointer transition-colors"
              >
                {isLoginState ? "No account? Create one" : "Already have an account? Sign in"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
