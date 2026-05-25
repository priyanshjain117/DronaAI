'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  BrainCircuit,
  MessageSquare,
  LayoutDashboard,
  GraduationCap,
  Plus,
  LogOut,
  Menu,
  X,
  Trash2,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  FileText,
  Library,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { formatTimestamp } from '@/lib/formatDate';
import ThemeToggle from '@/components/ThemeToggle';

interface ChatSessionItem {
  id: number;
  title: string;
  updated_at: string;
  message_count: number;
  document_id?: number | null;
  documents?: { id: number; filename: string }[];
  groups?: { id: number; name: string; slug: string; doc_count?: number }[];
}

interface DocumentItem {
  id: number;
  filename: string;
  created_at: string;
}

interface GroupItem {
  id: number;
  name: string;
  slug: string;
  color?: string;
  doc_count?: number;
  updated_at?: string;
}

function SidebarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeSessionId = searchParams.get('session');
  const logout = useStore((state) => state.logout);
  const token = useStore((state) => state.token);
  const user = useStore((state) => state.user);
  const collapsed = useStore((state) => state.sidebarCollapsed);
  const setCollapsed = useStore((state) => state.setSidebarCollapsed);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState('');

  const { data: sessions = [] } = useQuery<ChatSessionItem[]>({
    queryKey: ['chat-sessions', user?.id],
    queryFn: async () => {
      const { data } = await api.get('/sessions/');
      return data;
    },
    enabled: !!token && !!user,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const { data: documents = [] } = useQuery<DocumentItem[]>({
    queryKey: ['documents', user?.id],
    queryFn: async () => {
      const { data } = await api.get('/upload/');
      return data;
    },
    enabled: !!token && !!user,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const { data: groups = [] } = useQuery<GroupItem[]>({
    queryKey: ['document-groups', user?.id],
    queryFn: async () => {
      const { data } = await api.get('/groups/');
      return data;
    },
    enabled: !!token && !!user,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const filteredSessions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return sessions;
    return sessions.filter((session) => session.title.toLowerCase().includes(normalized));
  }, [query, sessions]);

  const filteredDocuments = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const docs = normalized
      ? documents.filter((document) => document.filename.toLowerCase().includes(normalized))
      : documents;
    return docs.slice(0, 6);
  }, [documents, query]);

  const filteredGroups = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const items = normalized
      ? groups.filter((group) => `${group.name} ${group.slug}`.toLowerCase().includes(normalized))
      : groups;
    return items.slice(0, 8);
  }, [groups, query]);

  const attachDocumentToGroupMutation = useMutation({
    mutationFn: async ({ groupId, documentId }: { groupId: number; documentId: number }) => {
      await api.post(`/groups/${groupId}/documents/${documentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-groups'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/sessions/${id}`);
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
      if (activeSessionId === String(id)) router.push('/chat');
    },
  });

  const handleLogout = () => {
    logout();
    queryClient.clear();
    router.push('/');
  };

  const handleNewChat = () => {
    router.push('/chat');
    setMobileOpen(false);
  };

  useEffect(() => {
    const id = window.setTimeout(() => setMobileOpen(false), 0);
    return () => window.clearTimeout(id);
  }, [pathname, searchParams]);

  const sidebarContent = (
    <>
      <div className="p-4">
        <div className="mb-5 flex items-center justify-between gap-2">
          <Link className="flex min-w-0 items-center gap-2" href="/dashboard" onClick={() => setMobileOpen(false)}>
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 shadow-lg shadow-orange-950/35">
              <BrainCircuit className="h-5 w-5 text-white" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <span className="font-heading block truncate text-lg font-bold tracking-normal text-slate-50">DronaAI</span>
                <span className="block truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Learning OS</span>
              </div>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="hidden rounded-lg p-2 text-slate-500 transition hover:bg-slate-800 hover:text-slate-200 md:grid"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        <button
          onClick={handleNewChat}
          className={`primary-action w-full py-3 ${
            collapsed ? 'px-0' : ''
          }`}
        >
          <Plus className="h-5 w-5" />
          {!collapsed && 'New Chat'}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {!collapsed && (
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search chats and notes"
              className="smart-input h-10 w-full pl-9 pr-3"
            />
          </div>
        )}

        <div className="space-y-1">
          <Link
            href="/dashboard"
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${
              pathname === '/dashboard'
                ? 'bg-orange-500/10 text-orange-700 ring-1 ring-orange-400/25 shadow-sm shadow-orange-950/25 dark:text-orange-200'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
            } ${collapsed ? 'justify-center px-0' : ''}`}
          >
            <LayoutDashboard className="h-5 w-5 shrink-0" />
            <span className={`${collapsed ? 'sr-only' : ''}`}>Dashboard</span>
          </Link>

          <Link
            href="/chat"
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${
              pathname === '/chat' && !activeSessionId
                ? 'bg-orange-500/10 text-orange-700 ring-1 ring-orange-400/25 shadow-sm shadow-orange-950/25 dark:text-orange-200'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
            } ${collapsed ? 'justify-center px-0' : ''}`}
          >
            <MessageSquare className="h-5 w-5 shrink-0" />
            <span className={`${collapsed ? 'sr-only' : ''}`}>Chats</span>
          </Link>

          <Link
            href="/study"
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${
              pathname === '/study'
                ? 'bg-orange-500/10 text-orange-700 ring-1 ring-orange-400/25 shadow-sm shadow-orange-950/25 dark:text-orange-200'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
            } ${collapsed ? 'justify-center px-0' : ''}`}
          >
            <GraduationCap className="h-5 w-5 shrink-0" />
            <span className={`${collapsed ? 'sr-only' : ''}`}>Study</span>
          </Link>
        </div>

        {!collapsed && filteredGroups.length > 0 && (
          <div className="mt-6">
            <div className="mb-2 px-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Study Spaces</div>
            <div className="space-y-1">
              {filteredGroups.map((group) => (
                <Link
                  href={`/chat?group=${group.id}`}
                  key={group.id}
                  onClick={() => setMobileOpen(false)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    const documentId = Number(event.dataTransfer.getData('application/drona-document-id'));
                    if (documentId) attachDocumentToGroupMutation.mutate({ groupId: group.id, documentId });
                  }}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
                >
                  <Library className="h-4 w-4 shrink-0 text-emerald-300" />
                  <span className="min-w-0 flex-1 truncate">@{group.slug}</span>
                  <span className="text-xs text-slate-600">{group.doc_count || 0}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {!collapsed && filteredDocuments.length > 0 && (
          <div className="mt-6">
            <div className="mb-2 px-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Knowledge Base</div>
            <div className="space-y-1">
              {filteredDocuments.map((document) => (
                <Link
                  href={`/chat?document=${document.id}`}
                  key={document.id}
                  onClick={() => setMobileOpen(false)}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData('application/drona-document-id', String(document.id));
                    event.dataTransfer.effectAllowed = 'copy';
                  }}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
                >
                  <FileText className="h-4 w-4 shrink-0 text-orange-400" />
                  <span className="truncate">{document.filename}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {!collapsed && (
          <div className="mt-6">
            <div className="mb-2 px-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Recent Tutoring</div>
            <div className="space-y-1">
              {filteredSessions.slice(0, 24).map((session) => (
                <div key={session.id} className="group relative">
                  <Link
                    href={`/chat?session=${session.id}`}
                    onClick={() => setMobileOpen(false)}
                    className={`block rounded-xl px-3 py-2.5 pr-10 transition ${
                      activeSessionId === String(session.id)
                        ? 'bg-orange-500/10 text-orange-800 ring-1 ring-orange-400/25 dark:text-orange-100'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                    }`}
                  >
                    <div className="truncate text-sm font-medium">{session.title}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                      <span>{session.message_count} msgs</span>
                      <span>&bull;</span>
                      <span>{session.documents?.length || 0} notes</span>
                      {session.groups && session.groups.length > 0 && (
                        <>
                          <span>&bull;</span>
                          <span>{session.groups.length} spaces</span>
                        </>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-slate-600">
                      {session.groups?.map((group) => `@${group.slug}`).join(', ') ||
                        session.documents?.map((document) => document.filename).join(', ') ||
                        formatTimestamp(session.updated_at)}
                    </div>
                  </Link>
                  <button
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      deleteMutation.mutate(session.id);
                    }}
                    className="absolute right-2 top-1/2 rounded-lg p-1.5 text-slate-500 opacity-0 transition hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                    aria-label="Delete chat"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {filteredSessions.length === 0 && (
                <div className="rounded-xl border border-slate-700 bg-[#111827] p-3 text-sm text-slate-500">
                  No matching chats yet.
                </div>
              )}
            </div>
          </div>
        )}
      </nav>

      <div className="border-t border-slate-800 p-3">
        <div className={`mb-2 ${collapsed ? 'flex justify-center' : ''}`}>
          <ThemeToggle compact={collapsed} />
        </div>
        <button
          onClick={handleLogout}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-slate-400 transition hover:bg-red-500/10 hover:text-red-300 ${
            collapsed ? 'justify-center px-0' : ''
          }`}
        >
          <LogOut className="h-5 w-5" />
          <span className={`${collapsed ? 'sr-only' : ''}`}>Logout</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-50 rounded-xl border border-slate-700 bg-[#111827] p-2 text-slate-300 shadow-xl transition hover:text-white md:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="animate-in slide-in-from-left relative flex h-dvh w-[min(86vw,320px)] flex-col border-r border-slate-800 bg-[#0B1220] shadow-2xl duration-300">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      <aside
        className={`hidden h-screen shrink-0 flex-col border-r border-slate-800 bg-[#0B1220] shadow-2xl shadow-black/20 transition-[width] duration-300 md:flex ${
          collapsed ? 'w-[76px]' : 'w-[286px]'
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}

export default function Sidebar() {
  return (
    <Suspense fallback={null}>
      <SidebarInner />
    </Suspense>
  );
}
