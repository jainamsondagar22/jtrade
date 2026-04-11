"use client";
import Link from "next/link";
import { auth } from "@/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function TopNav() {
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/auth");
  };

  return (
    <nav className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-8 text-sm select-none z-50 relative shrink-0">
      <div className="flex items-center gap-8">
        <span className="font-extrabold text-xl text-gray-900 tracking-tight">JTrade</span>
        <div className="hidden md:flex items-center gap-6 text-gray-500 font-medium">
          <Link href="/dashboard" className="hover:text-gray-900 cursor-pointer transition-colors">Dashboard</Link>
          <Link href="/charts" className="hover:text-gray-900 cursor-pointer transition-colors">Charts</Link>
          <Link href="/portfolio" className="hover:text-gray-900 cursor-pointer transition-colors">Portfolio</Link>
          <Link href="/patterns" className="hover:text-gray-900 cursor-pointer transition-colors">Patterns</Link>
          <Link href="/strategies" className="hover:text-gray-900 cursor-pointer transition-colors">Strategies</Link>
          <Link href="/analytics" className="hover:text-gray-900 cursor-pointer transition-colors">Analytics</Link>
        </div>
      </div>
      <div>
        <button 
          onClick={handleLogout}
          className="border border-gray-300 text-gray-700 font-medium px-4 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
