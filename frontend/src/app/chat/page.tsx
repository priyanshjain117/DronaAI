'use client';

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { API_URL, api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Send,
  User,
  Bot,
  Loader2,
  FileText,
  X,
  Paperclip,
  Sparkles,
  Search,
  Library,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';

interface Source {
  label: string;
  document_id?: number | null;
  filename?: string | null;
  page_number?: number | null;
  section_heading?: string | null;
  confidence?: number;
  relevance?: 'high' | 'medium' | 'low';
  snippet?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
}

interface DocumentItem {
  id: number;
  filename: string;
  status?: string;
  chunk_count?: number;
}

interface SessionMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
}

function ChatContent() {
  const token = useStore((state) => state.token);
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const sessionIdParam = searchParams.get('session');
  const documentIdParam = searchParams.get('document');

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(
    sessionIdParam ? Number(sessionIdParam) : null
  );
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [activeDocuments, setActiveDocuments] = useState<DocumentItem[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addActiveDocument = useCallback((document: DocumentItem) => {
    setActiveDocuments((prev) => {
      if (prev.some((item) => item.id === document.id)) return prev;
      return [...prev, document];
    });
  }, []);

  const removeActiveDocument = useCallback((documentId: number) => {
    setActiveDocuments((prev) => prev.filter((document) => document.id !== documentId));
  }, []);

  const { data: documents = [] } = useQuery<DocumentItem[]>({
    queryKey: ['documents'],
    queryFn: async () => {
      const { data } = await api.get('/upload/');
      return data;
    },
    enabled: !!token,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      if (currentSessionId) formData.append('session_id', String(currentSessionId));
      const { data } = await api.post('/upload/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: (document) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
      addActiveDocument({ id: document.id, filename: document.filename, status: document.status, chunk_count: document.chunks });
    },
  });

  const documentNameById = useMemo(() => {
    return new Map(documents.map((document) => [document.id, document.filename]));
  }, [documents]);

  const filteredDocs = useMemo(() => {
    return documents.filter((document) =>
      document.filename.toLowerCase().includes(mentionQuery.toLowerCase())
    );
  }, [documents, mentionQuery]);

  useEffect(() => {
    const id = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (mounted && !token) router.push('/login');
  }, [token, router, mounted]);

  useEffect(() => {
    const paramId = searchParams.get('session');
    const id = window.setTimeout(() => setCurrentSessionId(paramId ? Number(paramId) : null), 0);
    return () => window.clearTimeout(id);
  }, [searchParams]);

  useEffect(() => {
    const docId = documentIdParam ? Number(documentIdParam) : null;
    if (!docId) return;
    const document = documents.find((item) => item.id === docId);
    if (!document) return;
    const id = window.setTimeout(() => addActiveDocument(document), 0);
    return () => window.clearTimeout(id);
  }, [documentIdParam, documents, addActiveDocument]);

  useEffect(() => {
    if (currentSessionId && token && !isLoading) {
      api
        .get(`/sessions/${currentSessionId}`)
        .then(({ data }) => {
          setMessages(
            (data.messages || []).map((message: SessionMessage) => ({
              role: message.role,
              content: message.content,
              sources: message.sources || [],
            }))
          );
          setActiveDocuments(data.documents || []);
        })
        .catch(() => {
          setMessages([]);
          setCurrentSessionId(null);
          router.replace('/chat');
        });
    } else if (!currentSessionId && !isLoading) {
      const id = window.setTimeout(() => {
        setMessages([]);
        if (!documentIdParam) setActiveDocuments([]);
      }, 0);
      return () => window.clearTimeout(id);
    }
  }, [currentSessionId, token, isLoading, documents, router, documentIdParam]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isLoading]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = '0px';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
  }, [input]);

  const appendAssistantText = (text: string) => {
    setMessages((prev) => {
      const next = [...prev];
      const assistantIndex = next.findLastIndex((message) => message.role === 'assistant');

      if (assistantIndex === -1) {
        next.push({ role: 'assistant', content: text, sources: [] });
        return next;
      }

      const assistantMessage = { ...next[assistantIndex] };
      assistantMessage.content += text;
      next[assistantIndex] = assistantMessage;
      return next;
    });
  };

  const handleSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setShowMentionMenu(false);
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: userMsg },
      { role: 'assistant', content: '', sources: [] },
    ]);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/chat/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: userMsg,
          session_id: currentSessionId,
          document_ids: activeDocuments.map((document) => document.id),
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.detail || 'Unable to generate a response.');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Streaming is unavailable in this browser.');

      const decoder = new TextDecoder();
      let buffer = '';
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (!value) continue;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const eventText of events) {
          if (!eventText.startsWith('data: ')) continue;
          const payload = eventText.slice(6);

          if (payload === '[DONE]') {
            done = true;
            queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
            break;
          }

          const parsed = JSON.parse(payload);
          if (parsed.type === 'meta') {
            if (parsed.session_id && !currentSessionId) {
              setCurrentSessionId(parsed.session_id);
              window.history.replaceState(null, '', `/chat?session=${parsed.session_id}`);
            }
            if (Array.isArray(parsed.sources)) {
              setMessages((prev) => {
                const next = [...prev];
                const assistantIndex = next.findLastIndex((message) => message.role === 'assistant');
                if (assistantIndex === -1) return next;

                const assistantMessage = { ...next[assistantIndex], sources: parsed.sources };
                next[assistantIndex] = assistantMessage;
                return next;
              });
            }
            if (Array.isArray(parsed.active_document_ids)) {
              const activeIds = new Set<number>(parsed.active_document_ids);
              setActiveDocuments((prev) => prev.filter((document) => activeIds.has(document.id)));
            }
            continue;
          }

          if (parsed.text) appendAssistantText(parsed.text);
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Sorry, an error occurred while generating the response.';
      setMessages((prev) => {
        const next = [...prev];
        const last = { ...next[next.length - 1] };
        last.content = message;
        next[next.length - 1] = last;
        return next;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setInput(value);

    const lastAtPos = value.lastIndexOf('@');
    if (lastAtPos !== -1) {
      const query = value.slice(lastAtPos + 1);
      if (!query.includes(' ') && !query.includes('\n')) {
        setShowMentionMenu(true);
        setMentionQuery(query);
        return;
      }
    }

    setShowMentionMenu(false);
  };

  const selectDocument = (document: DocumentItem) => {
    addActiveDocument(document);
    setShowMentionMenu(false);
    const lastAtPos = input.lastIndexOf('@');
    if (lastAtPos !== -1) setInput(input.slice(0, lastAtPos).trimStart());
    textareaRef.current?.focus();
  };

  if (!mounted || !token) return null;

  return (
    <div className="flex h-dvh overflow-hidden bg-[#0B0F19] text-slate-100 selection:bg-orange-500/30">
      <Sidebar />

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="border-b border-white/8 bg-[#0B0F19]/80 px-5 py-4 backdrop-blur-xl md:px-8">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 pl-12 md:pl-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-orange-300">
                <Sparkles className="h-3.5 w-3.5" />
                AI Study Workspace
              </div>
              <h1 className="mt-1 truncate text-lg font-semibold text-slate-50">
                {activeDocuments.length > 0
                  ? `Workspace using ${activeDocuments.length} note${activeDocuments.length === 1 ? '' : 's'}`
                  : 'Ask across your notes or general concepts'}
              </h1>
              <div className="mt-2 flex max-w-3xl flex-wrap gap-2">
                {activeDocuments.length > 0 ? (
                  activeDocuments.map((document) => (
                    <span
                      key={document.id}
                      className="inline-flex max-w-[220px] items-center gap-1.5 rounded-full border border-orange-500/25 bg-orange-500/10 px-2.5 py-1 text-xs font-medium text-orange-200"
                    >
                      <FileText className="h-3 w-3 shrink-0" />
                      <span className="truncate">{document.filename}</span>
                      <span className="text-orange-200/60">{document.chunk_count ? `${document.chunk_count} chunks` : 'indexed'}</span>
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-500">No notes attached. Answers will use general knowledge only.</span>
                )}
              </div>
            </div>
            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-400 sm:flex">
              <Library className="h-3.5 w-3.5 text-orange-400" />
              {documents.length} indexed notes
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scroll-smooth">
          <div className="mx-auto w-full max-w-5xl px-4 pb-48 pt-8 md:px-8">
            {messages.length === 0 ? (
              <div className="grid min-h-[58vh] place-items-center">
                <div className="w-full max-w-2xl text-center">
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-orange-500/20 bg-orange-500/10 shadow-2xl shadow-orange-500/10">
                    <Bot className="h-8 w-8 text-orange-400" />
                  </div>
                  <h2 className="mt-6 text-3xl font-semibold tracking-tight text-slate-50">What are we learning today?</h2>
                  <p className="mx-auto mt-3 max-w-xl text-balance text-slate-400">
                    Ask a concept question, reference a note with @, or upload a new PDF directly from the composer.
                  </p>
                  <div className="mt-8 grid gap-3 text-left sm:grid-cols-2">
                    {[
                      'Summarize the key ideas in this lecture.',
                      'Explain this theorem with an example.',
                      'Create a quick revision checklist.',
                      'Compare these two concepts in a table.',
                    ].map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => setInput(prompt)}
                        className="rounded-2xl border border-white/8 bg-white/[0.04] p-4 text-sm text-slate-300 transition hover:border-orange-500/30 hover:bg-orange-500/10 hover:text-slate-100"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-5 sm:space-y-6">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex w-full items-start gap-2.5 sm:gap-3 ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {message.role === 'assistant' && (
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-orange-500/20 bg-orange-500/10">
                        <Bot className="h-5 w-5 text-orange-400" />
                      </div>
                    )}

                    <article
                      className={`min-w-0 max-w-[calc(100%-3rem)] overflow-hidden rounded-2xl px-4 py-3.5 shadow-xl sm:max-w-[78%] sm:px-5 sm:py-4 lg:max-w-[44rem] ${
                        message.role === 'user'
                          ? 'rounded-br-md bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-orange-500/15'
                          : 'rounded-bl-md border border-white/8 bg-[#111827]/90 text-slate-200 shadow-black/20 backdrop-blur'
                      }`}
                    >
                      {message.role === 'user' ? (
                        <p className="whitespace-pre-wrap break-words text-[15px] leading-7">{message.content}</p>
                      ) : message.content === '' ? (
                        <div className="flex h-7 items-center gap-1.5 px-1">
                          <span className="h-2 w-2 animate-bounce rounded-full bg-orange-400 [animation-delay:-0.25s]" />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-orange-300 [animation-delay:-0.12s]" />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-amber-300" />
                        </div>
                      ) : (
                        <>
                          <div className="drona-markdown overflow-hidden break-words">
                            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                              {message.content}
                            </ReactMarkdown>
                          </div>

                          {message.sources && message.sources.length > 0 && (
                            <div className="mt-4 border-t border-white/8 pt-3">
                              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                Sources used
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {message.sources.slice(0, 4).map((source) => (
                                  <details
                                    key={source.label}
                                    className="group max-w-full rounded-lg border border-white/8 bg-white/[0.035] px-2.5 py-1.5 text-xs text-slate-400 open:basis-full"
                                  >
                                    <summary className="flex cursor-pointer list-none items-center gap-2">
                                      <span className="font-semibold text-orange-300">[{source.label}]</span>
                                      <span className="max-w-[220px] truncate text-slate-300">
                                        {source.filename || (source.document_id ? documentNameById.get(source.document_id) : null) || 'Uploaded note'}
                                      </span>
                                      <span className="ml-auto rounded-full bg-white/[0.05] px-1.5 py-0.5 text-slate-500">
                                        {source.relevance === 'high'
                                          ? 'High relevance'
                                          : source.relevance === 'medium'
                                            ? 'Medium relevance'
                                            : 'Relevant'}
                                      </span>
                                    </summary>
                                    <div className="mt-2 border-t border-white/8 pt-2">
                                      {source.section_heading && (
                                        <div className="mb-1 truncate font-medium text-slate-400">{source.section_heading}</div>
                                      )}
                                      {source.snippet && <p className="line-clamp-3 leading-5 text-slate-500">{source.snippet}</p>}
                                    </div>
                                  </details>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </article>

                    {message.role === 'user' && (
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-[#1E293B]">
                        <User className="h-4 w-4 text-slate-300" />
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} className="h-3" />
              </div>
            )}
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#0B0F19] via-[#0B0F19]/96 to-transparent px-4 pb-4 pt-12 md:px-8">
          <div className="pointer-events-auto mx-auto w-full max-w-4xl">
            {showMentionMenu && filteredDocs.length > 0 && (
              <div className="mb-3 w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#111827]/95 shadow-2xl shadow-black/30 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center gap-2 border-b border-white/8 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  <Search className="h-3.5 w-3.5" />
                  Reference a note
                </div>
                <div className="max-h-52 overflow-y-auto p-1">
                  {filteredDocs.map((document) => (
                    <button
                      key={document.id}
                      type="button"
                      onClick={() => selectDocument(document)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-slate-200 transition hover:bg-white/[0.05]"
                    >
                      <FileText className="h-4 w-4 shrink-0 text-orange-400" />
                      <span className="truncate">{document.filename}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeDocuments.length > 0 && (
              <div className="mb-3 flex max-w-full flex-wrap gap-2">
                {activeDocuments.map((document) => (
                  <div
                    key={document.id}
                    className="inline-flex max-w-full items-center gap-2 rounded-full border border-orange-500/25 bg-orange-500/10 px-3 py-1.5 text-sm text-orange-200 shadow-lg shadow-orange-500/10 backdrop-blur"
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span className="max-w-[220px] truncate font-medium">{document.filename}</span>
                    <button
                      type="button"
                      onClick={() => removeActiveDocument(document.id)}
                      className="rounded-full p-0.5 transition hover:bg-orange-500/20"
                      aria-label={`Remove ${document.filename} from workspace`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="rounded-[2rem] border border-white/10 bg-[#111827]/92 p-2 shadow-2xl shadow-black/35 backdrop-blur-xl transition focus-within:border-orange-500/40 focus-within:ring-4 focus-within:ring-orange-500/10"
            >
              <div className="flex items-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,application/pdf,text/plain"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) uploadMutation.mutate(file);
                    event.target.value = '';
                  }}
                />
                <Button
                  type="button"
                  size="icon-lg"
                  variant="ghost"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadMutation.isPending}
                  className="mb-1 h-10 w-10 rounded-full text-slate-400 hover:bg-white/8 hover:text-orange-300"
                  aria-label="Upload note"
                >
                  {uploadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                </Button>
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder="Message DronaAI... use @ to focus a note"
                  className="max-h-[180px] min-h-12 resize-none border-0 bg-transparent px-1 py-3 text-[15px] leading-6 text-slate-100 shadow-none outline-none placeholder:text-slate-500 focus-visible:border-0 focus-visible:ring-0"
                  disabled={isLoading}
                />
                <Button
                  type="submit"
                  size="icon-lg"
                  disabled={!input.trim() || isLoading}
                  className="mb-1 h-10 w-10 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25 transition hover:brightness-110 disabled:shadow-none"
                  aria-label="Send message"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="ml-0.5 h-4 w-4" />}
                </Button>
              </div>
            </form>
            <p className="mt-3 text-center text-xs font-medium text-slate-500">
              DronaAI prioritizes your notes, adds general knowledge when useful, and can still make mistakes.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#0B0F19]">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      }
    >
      <ChatContent />
    </Suspense>
  );
}
