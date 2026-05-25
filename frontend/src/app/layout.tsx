import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "DronaAI - AI Learning OS",
  description: "A premium AI workspace for serious students.",
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
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-[#0B1220] text-slate-50 font-sans selection:bg-orange-500/30 selection:text-orange-100">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
