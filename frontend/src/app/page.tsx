import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Bot, FileText, Sparkles, BrainCircuit } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="px-4 lg:px-6 h-16 flex items-center border-b border-white/10 backdrop-blur-md bg-black/50 sticky top-0 z-50">
        <Link className="flex items-center justify-center" href="/">
          <BrainCircuit className="h-6 w-6 text-indigo-500" />
          <span className="ml-2 font-extrabold text-2xl md:text-3xl tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-500 drop-shadow-sm">DronaAI</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6 items-center">
          <Link className="text-sm font-medium hover:text-indigo-400 transition-colors" href="/login">
            Login
          </Link>
          <Link href="/signup">
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-6">
              Get Started
            </Button>
          </Link>
        </nav>
      </header>
      
      <main className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
        {/* Background gradient effects */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] -z-10" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] -z-10" />
        
        <section className="w-full py-24 md:py-32 lg:py-48 flex justify-center text-center px-4">
          <div className="max-w-3xl space-y-8">
            <div className="inline-flex items-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-sm font-medium text-indigo-300 backdrop-blur-sm shadow-[0_0_15px_rgba(99,102,241,0.2)] transition-colors hover:bg-indigo-500/20">
              <Sparkles className="mr-2 h-4 w-4" />
              Introducing DronaAI 1.0
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
              Your AI-Powered <br /> Study Companion
            </h1>
            <p className="text-xl text-zinc-400 md:text-2xl max-w-2xl mx-auto font-light">
              Upload your notes, textbooks, and study materials. Chat with them instantly and get concise, grounded answers powered by advanced RAG technology.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link href="/signup">
                <Button size="lg" className="h-14 px-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-lg w-full sm:w-auto">
                  Start Studying Now
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="h-14 px-8 rounded-full text-lg w-full sm:w-auto border-white/10 hover:bg-white/5">
                  Go to Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="w-full py-24 bg-zinc-950/50 border-t border-white/5 flex justify-center">
          <div className="max-w-5xl px-4 md:px-6 w-full">
            <div className="grid gap-12 lg:grid-cols-3">
              <div className="flex flex-col items-center text-center space-y-4 p-8 rounded-3xl bg-white/[0.02] border border-white/5 backdrop-blur-sm transition-all duration-300 hover:bg-white/[0.06] hover:-translate-y-2 hover:shadow-[0_10px_40px_-10px_rgba(99,102,241,0.15)] hover:border-indigo-500/20">
                <div className="p-4 bg-indigo-500/10 rounded-2xl">
                  <FileText className="h-8 w-8 text-indigo-400" />
                </div>
                <h3 className="text-xl font-bold">1. Upload Materials</h3>
                <p className="text-zinc-400">Drag and drop your PDFs, DOCX, or TXT files. We securely store and process your documents.</p>
              </div>
              <div className="flex flex-col items-center text-center space-y-4 p-8 rounded-3xl bg-white/[0.02] border border-white/5 backdrop-blur-sm transition-all duration-300 hover:bg-white/[0.06] hover:-translate-y-2 hover:shadow-[0_10px_40px_-10px_rgba(168,85,247,0.15)] hover:border-purple-500/20">
                <div className="p-4 bg-purple-500/10 rounded-2xl">
                  <BrainCircuit className="h-8 w-8 text-purple-400" />
                </div>
                <h3 className="text-xl font-bold">2. AI Processing</h3>
                <p className="text-zinc-400">Our RAG pipeline intelligently chunks and embeds your text for ultra-fast semantic search.</p>
              </div>
              <div className="flex flex-col items-center text-center space-y-4 p-8 rounded-3xl bg-white/[0.02] border border-white/5 backdrop-blur-sm transition-all duration-300 hover:bg-white/[0.06] hover:-translate-y-2 hover:shadow-[0_10px_40px_-10px_rgba(59,130,246,0.15)] hover:border-blue-500/20">
                <div className="p-4 bg-blue-500/10 rounded-2xl">
                  <Bot className="h-8 w-8 text-blue-400" />
                </div>
                <h3 className="text-xl font-bold">3. Chat & Learn</h3>
                <p className="text-zinc-400">Ask complex questions, get summaries, and clarify concepts instantly with source citations.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
      
      <footer className="py-6 w-full border-t border-white/10 flex items-center justify-center bg-black">
        <p className="text-xs text-zinc-500">
          © 2026 DronaAI. Hackathon Project. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
