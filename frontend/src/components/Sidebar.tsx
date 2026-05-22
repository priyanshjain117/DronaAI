'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrainCircuit, MessageSquare, LayoutDashboard, PlusCircle, LogOut } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useRouter } from 'next/navigation';

export default function Sidebar() {
  const pathname = usePathname();
  const logout = useStore((state) => state.logout);
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <aside className="w-64 border-r border-white/5 bg-[#0A0F1C]/80 backdrop-blur-xl h-screen sticky top-0 flex flex-col hidden md:flex shrink-0">
      <div className="p-6">
        <Link className="flex items-center gap-2 mb-8" href="/dashboard">
          <BrainCircuit className="h-7 w-7 text-blue-500" />
          <span className="font-bold text-xl tracking-tight text-slate-100">DronaAI</span>
        </Link>

        <Link href="/chat">
          <button className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-3 px-4 flex items-center justify-center gap-2 font-medium transition-all shadow-lg shadow-blue-500/20 active:scale-95">
            <PlusCircle className="h-5 w-5" />
            New Chat
          </button>
        </Link>
      </div>

      <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 px-2">Menu</div>
        
        <Link 
          href="/dashboard"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
            pathname === '/dashboard' 
              ? 'bg-blue-500/10 text-blue-400 font-medium' 
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <LayoutDashboard className="h-5 w-5" />
          Dashboard
        </Link>

        <Link 
          href="/chat"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
            pathname === '/chat' 
              ? 'bg-blue-500/10 text-blue-400 font-medium' 
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <MessageSquare className="h-5 w-5" />
          Chats
        </Link>
      </nav>

      <div className="p-4 border-t border-white/5">
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <LogOut className="h-5 w-5" />
          Logout
        </button>
      </div>
    </aside>
  );
}
