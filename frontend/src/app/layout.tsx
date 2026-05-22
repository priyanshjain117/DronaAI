import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "DronaAI - Study Assistant",
  description: "Your AI-Powered Study Companion",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased dark"
    >
      <body className="min-h-full flex flex-col bg-[#0B0F19] text-slate-50 font-sans selection:bg-orange-500/30 selection:text-orange-200">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
