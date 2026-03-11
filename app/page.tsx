import { AuthProvider } from "@/context/AuthContext";
import "./globals.css";
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/auth");
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}