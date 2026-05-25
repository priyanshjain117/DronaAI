'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Bot, FileText, Sparkles, BrainCircuit, ArrowRight, Zap, CheckCircle2 } from 'lucide-react';
import { motion, Variants } from 'framer-motion';
import ThemeToggle from '@/components/ThemeToggle';

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
    <div className="flex min-h-screen flex-col bg-[#0B1220] text-slate-50 selection:bg-orange-500/30 selection:text-orange-100">
      {/* Navigation */}
      <header className="sticky top-0 z-50 flex h-20 items-center border-b border-slate-800 bg-[#0B1220]/95 px-6 lg:px-12">
        <Link className="flex items-center justify-center gap-2 group" href="/">
          <div className="rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 p-2 shadow-lg shadow-orange-950/30 transition-transform group-hover:-translate-y-0.5">
            <BrainCircuit className="h-6 w-6 text-white" />
          </div>
          <span className="font-heading text-xl font-bold tracking-normal text-slate-100">DronaAI</span>
        </Link>
        <nav className="ml-auto flex items-center gap-4 sm:gap-6">
          <ThemeToggle compact />
          <Link className="text-sm font-medium text-slate-400 hover:text-slate-100 transition-colors" href="/login">
            Sign in
          </Link>
          <Link href="/signup">
            <Button className="primary-action rounded-full px-6">
              Get Started
            </Button>
          </Link>
        </nav>
      </header>

      <main className="relative flex flex-1 flex-col items-center overflow-hidden bg-[linear-gradient(120deg,rgba(249,115,22,0.12),transparent_32rem),radial-gradient(circle_at_88%_8%,rgba(34,211,238,0.12),transparent_28rem)]">
        {/* Hero Section */}
        <section className="relative z-10 flex w-full justify-center px-4 pb-20 pt-28 text-center md:pb-28 md:pt-36">
          <motion.div
            initial="hidden"
            animate="show"
            variants={stagger}
            className="max-w-4xl space-y-8 flex flex-col items-center"
          >
            <motion.div variants={fadeUp} className="concept-chip">
              <Sparkles className="mr-2 h-4 w-4" />
              Next-Generation Study Intelligence
            </motion.div>

            <motion.h1 variants={fadeUp} className="font-heading text-5xl font-bold leading-[1.08] tracking-normal text-slate-50 md:text-7xl">
              The AI Learning OS <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-400">
                for Serious Students
              </span>
            </motion.h1>

            <motion.p variants={fadeUp} className="mx-auto max-w-2xl text-lg leading-8 text-slate-300 md:text-xl">
              Upload your notes, chat with them, generate revision plans, and turn raw study material into an elite exam-prep workspace.
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8 w-full sm:w-auto">
              <Link href="/signup" className="w-full sm:w-auto">
                <Button size="lg" className="primary-action h-14 w-full rounded-full px-8 text-base">
                  Start Studying for Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/login" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="h-14 w-full rounded-full border-slate-700 bg-slate-900 px-8 text-base font-semibold text-slate-300 hover:bg-slate-800">
                  View Live Demo
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </section>

        {/* Workflow Section */}
        <section className="relative z-10 flex w-full justify-center border-y border-slate-800 bg-[#111827] py-24">
          <div className="max-w-6xl px-6 w-full">
            <div className="text-center mb-16">
              <h2 className="font-heading mb-4 text-3xl font-bold text-slate-100">How DronaAI Works</h2>
              <p className="mx-auto max-w-xl text-slate-400">A seamless, intelligent pipeline from source material to understanding.</p>
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
                  className="study-card flex flex-col space-y-4 p-8"
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
        <section className="relative z-10 flex w-full justify-center py-28">
          <div className="max-w-4xl px-6 w-full text-center">
            <h2 className="font-heading mb-12 text-3xl font-bold text-slate-100 md:text-4xl">Designed for Deep Focus</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left">
              {[
                "Distraction-free minimal interface",
                "Dark mode optimized for long sessions",
                "Instant document referencing",
                "Lightning-fast streaming responses",
                "Secure, private document storage",
                "Highly accurate RAG citations"
              ].map((benefit, i) => (
                <div key={i} className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-[#111827] p-4">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                  <span className="text-slate-300 font-medium">{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="flex w-full items-center justify-center border-t border-slate-800 bg-[#0B1220] py-8">
        <p className="text-sm text-slate-500">
          © {new Date().getFullYear()} DronaAI. Premium AI Study Platform.
        </p>
      </footer>
    </div>
  );
}
