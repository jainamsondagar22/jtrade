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
  const [isLogin, setIsLogin] = useState(true);
  const [message, setMessage] = useState("");
  const router = useRouter();

  const handleAuth = async () => {
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        setMessage("Logged in successfully!");
        router.push("/dashboard");
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        // Save default user data to Firestore
        await setDoc(doc(db, "users", user.uid), {
          email: user.email,
          watchlist: [],
          portfolio: [],
          preferences: {},
          createdAt: new Date(),
        });
        router.push("/dashboard");
        setMessage("Account created successfully!");
      }
    } catch (error: any) {
      setMessage(error.message);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded shadow-md w-96">
        <h1 className="text-2xl font-bold mb-6">{isLogin ? "Login" : "Sign Up"}</h1>
        <input
          className="border w-full p-2 mb-4 rounded"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="border w-full p-2 mb-4 rounded"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          className="bg-blue-500 text-white w-full p-2 rounded hover:bg-blue-600"
          onClick={handleAuth}
        >
          {isLogin ? "Login" : "Sign Up"}
        </button>
        <p className="mt-4 text-center text-sm text-gray-600">{message}</p>
        <p
          className="mt-2 text-center text-blue-500 cursor-pointer text-sm"
          onClick={() => setIsLogin(!isLogin)}
        >
          {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Login"}
        </p>
      </div>
    </div>
  );
}
