'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Bot, FileText, Sparkles, BrainCircuit, ArrowRight, Zap, CheckCircle2 } from 'lucide-react';
import { motion, Variants } from 'framer-motion';

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
};

const stagger: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-[#0B0F19] selection:bg-orange-500/30 selection:text-orange-200">
      {/* Navigation */}
      <header className="px-6 lg:px-12 h-20 flex items-center border-b border-white/5 backdrop-blur-xl bg-[#0B0F19]/80 sticky top-0 z-50">
        <Link className="flex items-center justify-center gap-2 group" href="/">
          <div className="p-2 bg-orange-500/10 rounded-xl group-hover:bg-orange-500/20 transition-colors">
            <BrainCircuit className="h-6 w-6 text-orange-500" />
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-100">DronaAI</span>
        </Link>
        <nav className="ml-auto flex gap-6 items-center">
          <Link className="text-sm font-medium text-slate-400 hover:text-slate-100 transition-colors" href="/login">
            Sign in
          </Link>
          <Link href="/signup">
            <Button className="bg-orange-600 hover:bg-orange-500 text-white rounded-full px-6 shadow-[0_0_15px_rgba(249,115,22,0.2)] transition-all hover:shadow-[0_0_25px_rgba(249,115,22,0.4)]">
              Get Started
            </Button>
          </Link>
        </nav>
      </header>

      <main className="flex-1 flex flex-col items-center relative overflow-hidden">
        {/* Subtle Background Glow */}
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-orange-600/8 rounded-full blur-[120px] pointer-events-none" />

        {/* Hero Section */}
        <section className="w-full pt-32 pb-24 md:pt-40 md:pb-32 flex justify-center text-center px-4 relative z-10">
          <motion.div
            initial="hidden"
            animate="show"
            variants={stagger}
            className="max-w-4xl space-y-8 flex flex-col items-center"
          >
            <motion.div variants={fadeUp} className="inline-flex items-center rounded-full border border-orange-500/20 bg-orange-500/10 px-4 py-1.5 text-sm font-medium text-orange-400 backdrop-blur-md">
              <Sparkles className="mr-2 h-4 w-4" />
              Next-Generation Study Intelligence
            </motion.div>

            <motion.h1 variants={fadeUp} className="text-5xl md:text-7xl font-bold tracking-tight text-slate-50 leading-[1.1]">
              Your AI-Powered <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-400">
                Study Companion
              </span>
            </motion.h1>

            <motion.p variants={fadeUp} className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Upload your notes, textbooks, and study materials. Chat with them instantly, generate summaries, and simplify exam preparation using advanced AI.
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8 w-full sm:w-auto">
              <Link href="/signup" className="w-full sm:w-auto">
                <Button size="lg" className="h-14 px-8 bg-orange-600 hover:bg-orange-500 text-white rounded-full text-base font-medium w-full shadow-[0_0_20px_rgba(249,115,22,0.3)] transition-all hover:scale-105">
                  Start Studying for Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/login" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="h-14 px-8 rounded-full text-base font-medium w-full border-white/10 hover:bg-white/5 text-slate-300">
                  View Live Demo
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </section>

        {/* Workflow Section */}
        <section className="w-full py-24 bg-[#111827]/50 border-y border-white/5 flex justify-center relative z-10">
          <div className="max-w-6xl px-6 w-full">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-slate-100 mb-4">How DronaAI Works</h2>
              <p className="text-slate-400 max-w-xl mx-auto">A seamless, intelligent pipeline from upload to understanding.</p>
            </div>

            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="grid gap-8 md:grid-cols-3"
            >
              {[
                {
                  icon: FileText,
                  title: "1. Ingest Knowledge",
                  desc: "Drag and drop your PDFs or TXT files. We securely parse and process your documents instantly."
                },
                {
                  icon: Zap,
                  title: "2. AI Vectorization",
                  desc: "Our RAG pipeline intelligently chunks and embeds your text for ultra-fast semantic search."
                },
                {
                  icon: Bot,
                  title: "3. Chat & Learn",
                  desc: "Ask complex questions, get summaries, and clarify concepts instantly with perfect context."
                }
              ].map((step, i) => (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  className="flex flex-col space-y-4 p-8 rounded-3xl bg-[#1E293B]/50 border border-white/5 backdrop-blur-xl hover:bg-[#1E293B] transition-colors"
                >
                  <div className="h-12 w-12 bg-orange-500/10 rounded-2xl flex items-center justify-center mb-2">
                    <step.icon className="h-6 w-6 text-orange-400" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-200">{step.title}</h3>
                  <p className="text-slate-400 leading-relaxed">{step.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="w-full py-32 flex justify-center relative z-10">
          <div className="max-w-4xl px-6 w-full text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-100 mb-12">Designed for Deep Focus</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left">
              {[
                "Distraction-free minimal interface",
                "Dark mode optimized for long sessions",
                "Instant document referencing",
                "Lightning-fast streaming responses",
                "Secure, private document storage",
                "Highly accurate RAG citations"
              ].map((benefit, i) => (
                <div key={i} className="flex items-center gap-3 p-4 rounded-2xl bg-[#111827] border border-white/5">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                  <span className="text-slate-300 font-medium">{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="py-8 w-full border-t border-white/5 flex items-center justify-center bg-[#0B0F19]">
        <p className="text-sm text-slate-500">
          © {new Date().getFullYear()} DronaAI. Premium AI Study Platform.
        </p>
      </footer>
    </div>
  );
}
