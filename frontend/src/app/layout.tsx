import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jbMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

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
      className={`${inter.variable} ${jbMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-[#0A0F1C] text-slate-50 font-sans selection:bg-blue-500/30 selection:text-blue-200">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
