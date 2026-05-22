'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { API_URL } from '@/services/api';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BrainCircuit, Send, User, Bot, LayoutDashboard, Loader2, FileText, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import { api } from '@/services/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatPage() {
  const token = useStore((state) => state.token);
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Mention State
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [selectedDocument, setSelectedDocument] = useState<{ id: number, filename: string } | null>(null);

  const { data: documents } = useQuery<{ id: number, filename: string }[]>({
    queryKey: ['documents'],
    queryFn: async () => {
      const { data } = await api.get('/upload/');
      return data;
    },
    enabled: !!token,
  });

  useEffect(() => {
    if (mounted && !token) {
      router.push('/login');
    }
  }, [token, router, mounted]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);
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
          document_id: selectedDocument?.id || null
        }),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let buffer = '';

      while (!done) {
        const { value, done: readerDone } = await reader!.read();
        done = readerDone;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                done = true;
                break;
              }
              try {
                const parsed = JSON.parse(data);
                if (parsed.text) {
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    const lastMsg = { ...newMessages[newMessages.length - 1] };
                    lastMsg.content += parsed.text;
                    newMessages[newMessages.length - 1] = lastMsg;
                    return newMessages;
                  });
                }
              } catch (e) {
                console.error('Error parsing JSON:', e);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => {
        const newMessages = [...prev];
        const lastMsg = newMessages[newMessages.length - 1];
        lastMsg.content = 'Sorry, an error occurred while generating the response.';
        return newMessages;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);

    // Detect @ mention
    const lastAtPos = val.lastIndexOf('@');
    if (lastAtPos !== -1 && !selectedDocument) {
      const query = val.slice(lastAtPos + 1);
      if (!query.includes(' ')) {
        setShowMentionMenu(true);
        setMentionQuery(query);
        return;
      }
    }
    setShowMentionMenu(false);
  };

  const selectDocument = (doc: { id: number, filename: string }) => {
    setSelectedDocument(doc);
    setShowMentionMenu(false);
    // Replace the @query part in the input
    const lastAtPos = input.lastIndexOf('@');
    if (lastAtPos !== -1) {
      setInput(input.slice(0, lastAtPos));
    }
    inputRef.current?.focus();
  };

  const filteredDocs = documents?.filter(d => d.filename.toLowerCase().includes(mentionQuery.toLowerCase())) || [];

  if (!mounted || !token) return null;

  return (
    <div className="flex h-screen bg-[#0A0F1C] overflow-hidden selection:bg-blue-500/30">
      <Sidebar />

      <main className="flex-1 flex flex-col relative w-full items-center overflow-hidden">
        <div className="flex-1 w-full overflow-y-auto scroll-smooth">
          <div className="w-full max-w-4xl mx-auto px-4 lg:px-8 pt-8 pb-48">
            {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 mt-32 space-y-4">
              <div className="h-16 w-16 rounded-2xl bg-[#161F32] border border-white/5 flex items-center justify-center shadow-2xl">
                <Bot className="h-8 w-8 text-blue-400" />
              </div>
              <p className="text-lg">How can I help you study today?</p>
            </div>
          ) : (
            <div className="space-y-8 pb-32">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                  {msg.role === 'assistant' && (
                    <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 mt-1">
                      <Bot className="h-6 w-6 text-blue-400" />
                    </div>
                  )}
                  <div 
                    className={`max-w-[85%] rounded-3xl p-5 shadow-sm ${
                      msg.role === 'user' 
                        ? 'bg-gradient-to-br from-blue-500 to-sky-500 text-white rounded-br-none shadow-[0_4px_20px_rgba(59,130,246,0.2)]' 
                        : 'bg-[#161F32]/80 backdrop-blur-xl border border-white/5 rounded-bl-none text-slate-200 prose prose-invert max-w-none shadow-[0_4px_20px_rgba(0,0,0,0.2)]'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      msg.content
                    ) : msg.content === '' ? (
                      <div className="flex space-x-1.5 h-6 items-center px-1">
                        <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"></div>
                      </div>
                    ) : (
                      <div className="prose-p:leading-relaxed prose-pre:bg-[#0A0F1C]/80 prose-pre:border prose-pre:border-white/5 text-[15px] marker:text-blue-400">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="h-10 w-10 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center shrink-0 mt-1 shadow-md">
                      <User className="h-5 w-5 text-slate-300" />
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} className="h-4" />
            </div>
          )}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#0A0F1C] via-[#0A0F1C]/90 to-transparent pt-10 pb-6 px-4 lg:px-8 flex flex-col items-center pointer-events-none">
          <div className="w-full max-w-3xl relative pointer-events-auto">
            {showMentionMenu && filteredDocs.length > 0 && (
              <div className="absolute bottom-full mb-3 w-72 bg-[#161F32] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2 backdrop-blur-xl">
                <div className="px-4 py-2.5 border-b border-white/5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Select a document
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {filteredDocs.map(doc => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => selectDocument(doc)}
                      className="w-full text-left px-4 py-3 hover:bg-white/5 flex items-center gap-3 text-sm text-slate-200 transition-colors"
                    >
                      <FileText className="h-4 w-4 text-sky-400 shrink-0" />
                      <span className="truncate">{doc.filename}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedDocument && (
              <div className="mb-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm shadow-sm backdrop-blur-md">
                <FileText className="h-3.5 w-3.5" />
                <span className="max-w-[200px] truncate font-medium">{selectedDocument.filename}</span>
                <button 
                  type="button" 
                  onClick={() => setSelectedDocument(null)}
                  className="hover:bg-blue-500/20 rounded-full p-0.5 ml-1 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="relative flex items-center shadow-2xl rounded-full">
              <Input
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                placeholder="Message DronaAI... Type @ to reference a document"
                className="pr-14 bg-[#161F32]/80 backdrop-blur-xl border border-white/10 h-14 rounded-full focus-visible:ring-1 focus-visible:ring-blue-500/50 focus-visible:border-blue-500/50 text-base shadow-inner text-slate-100 placeholder:text-slate-500"
                disabled={isLoading}
              />
              <Button 
                type="submit" 
                size="icon"
                disabled={!input.trim() || isLoading}
                className="absolute right-2 h-10 w-10 rounded-full bg-blue-600 hover:bg-blue-500 transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)] disabled:opacity-50 disabled:shadow-none"
              >
                <Send className="h-4 w-4 ml-0.5" />
              </Button>
            </form>
            <p className="text-xs text-center text-slate-500 mt-3 font-medium">
              DronaAI can make mistakes. Consider verifying important information.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
