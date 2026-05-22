'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { API_URL } from '@/services/api';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BrainCircuit, Send, User, Bot, LayoutDashboard, Loader2, FileText, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useQuery } from '@tanstack/react-query';

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Mention State
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [selectedDocument, setSelectedDocument] = useState<{ id: number, filename: string } | null>(null);

  const { data: documents } = useQuery<{ id: number, filename: string }[]>({
    queryKey: ['documents'],
    queryFn: async () => {
      const { data } = await fetch(`${API_URL}/upload/`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => res.json());
      return data;
    },
    enabled: !!token,
  });

  useEffect(() => {
    if (!token) {
      router.push('/login');
    }
  }, [token, router]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
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

      while (!done) {
        const { value, done: readerDone } = await reader!.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n\n');
          
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
                    const lastMsg = newMessages[newMessages.length - 1];
                    lastMsg.content = parsed.text; // Fixed from += to =
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

  if (!token) return null;

  return (
    <div className="h-screen flex flex-col bg-zinc-950">
      <header className="px-6 h-16 flex items-center border-b border-white/10 bg-black/50 shrink-0">
        <Link className="flex items-center gap-2" href="/">
          <BrainCircuit className="h-6 w-6 text-indigo-500" />
          <span className="font-bold text-xl tracking-tighter">DronaAI</span>
        </Link>
        <div className="ml-auto">
          <Link href="/dashboard">
            <Button variant="ghost" className="text-zinc-400 hover:text-white">
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col max-w-4xl w-full mx-auto p-4">
        <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-500 mt-32 space-y-4">
              <Bot className="h-12 w-12 text-zinc-700" />
              <p>Start a conversation about your documents...</p>
            </div>
          ) : (
            <div className="space-y-6 pb-6">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                  {msg.role === 'assistant' && (
                    <div className="h-8 w-8 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
                      <Bot className="h-5 w-5 text-indigo-400" />
                    </div>
                  )}
                  <div 
                    className={`max-w-[85%] rounded-3xl p-5 shadow-sm ${
                      msg.role === 'user' 
                        ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-br-none shadow-indigo-500/20' 
                        : 'bg-[#18181b] border border-white/5 rounded-bl-none text-zinc-200 prose prose-invert max-w-none shadow-black/50'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      msg.content
                    ) : msg.content === '' ? (
                      <div className="flex space-x-1 h-6 items-center">
                        <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce"></div>
                      </div>
                    ) : (
                      <div className="prose-p:leading-relaxed prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/10 text-[15px]">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="h-10 w-10 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 text-zinc-300" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="pt-4 shrink-0 relative">
          {showMentionMenu && filteredDocs.length > 0 && (
            <div className="absolute bottom-full mb-2 w-72 bg-[#18181b] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2">
              <div className="px-3 py-2 border-b border-white/5 text-xs font-medium text-zinc-400">
                Mention a document
              </div>
              <ScrollArea className="max-h-48">
                {filteredDocs.map(doc => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => selectDocument(doc)}
                    className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center gap-2 text-sm text-zinc-300 transition-colors"
                  >
                    <FileText className="h-4 w-4 text-indigo-400 shrink-0" />
                    <span className="truncate">{doc.filename}</span>
                  </button>
                ))}
              </ScrollArea>
            </div>
          )}

          {selectedDocument && (
            <div className="mb-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm">
              <FileText className="h-3.5 w-3.5" />
              <span className="max-w-[200px] truncate">{selectedDocument.filename}</span>
              <button 
                type="button" 
                onClick={() => setSelectedDocument(null)}
                className="hover:bg-indigo-500/20 rounded-full p-0.5 ml-1"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="relative flex items-center">
            <Input
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              placeholder="Ask a question... Type @ to target a specific document"
              className="pr-12 bg-white/5 border-white/10 h-14 rounded-2xl focus-visible:ring-indigo-500 text-base shadow-inner"
              disabled={isLoading}
            />
            <Button 
              type="submit" 
              size="icon"
              disabled={!input.trim() || isLoading}
              className="absolute right-2 h-10 w-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20"
            >
              <Send className="h-5 w-5" />
            </Button>
          </form>
          <p className="text-xs text-center text-zinc-500 mt-2">
            AI can make mistakes. Consider verifying important information.
          </p>
        </div>
      </main>
    </div>
  );
}
