'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  GraduationCap,
  Layers3,
  Library,
  Loader2,
  RotateCcw,
  Shuffle,
  Sparkles,
  Target,
  Timer,
  XCircle,
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { api } from '@/services/api';
import { useStore } from '@/store/useStore';

interface DocumentItem {
  id: number;
  filename: string;
  status?: string;
  chunk_count?: number;
}

interface GroupItem {
  id: number;
  name: string;
  slug: string;
  doc_count?: number;
}

interface StudyMaterial {
  id: number;
  material_type: 'summary' | 'flashcards' | 'mcq' | 'revision';
  mode: string;
  difficulty: string;
  title: string;
  confidence: number;
  progress?: Record<string, { status?: string; marked_difficult?: boolean; correct_count?: number; wrong_count?: number }>;
  content?: StudyContent;
  created_at: string;
}

interface StudyContent {
  sections?: { heading: string; bullets: string[]; source_labels?: string[] }[];
  definitions?: { term: string; definition: string; source_labels?: string[] }[];
  likely_questions?: string[];
  cards?: { id: string; type: string; front: string; back: string; topic?: string; difficulty?: string }[];
  questions?: {
    id: string;
    type: string;
    question: string;
    options: string[];
    correct_answer: string;
    explanation: string;
    topic?: string;
    difficulty?: string;
  }[];
  high_yield?: string[];
  formula_sheet?: string[];
  concept_map?: { topic: string; links: string[] }[];
  important_questions?: string[];
  revision_order?: string[];
  notes?: string[];
}

const toolOptions = [
  { id: 'summary', label: 'Summary', icon: BookOpen },
  { id: 'flashcards', label: 'Flashcards', icon: Layers3 },
  { id: 'mcq', label: 'MCQ Test', icon: ClipboardList },
  { id: 'revision', label: 'Revision', icon: Target },
] as const;

const modeOptions: Record<string, { value: string; label: string }[]> = {
  summary: [
    { value: 'short', label: 'Short' },
    { value: 'detailed', label: 'Detailed' },
    { value: 'exam', label: 'Exam' },
    { value: 'bullets', label: 'Bullet Notes' },
    { value: 'simple', label: 'Simple' },
  ],
  flashcards: [
    { value: 'exam', label: 'Exam Recall' },
    { value: 'concept', label: 'Conceptual' },
    { value: 'formula', label: 'Formulas' },
    { value: 'true-false', label: 'True/False' },
  ],
  mcq: [
    { value: 'conceptual', label: 'Conceptual' },
    { value: 'factual', label: 'Factual' },
    { value: 'application', label: 'Application' },
    { value: 'mixed', label: 'Mixed Exam' },
  ],
  revision: [
    { value: 'night-before', label: 'Night Before' },
    { value: 'formula', label: 'Formula Sheet' },
    { value: 'interview', label: 'Interview Prep' },
    { value: 'important-questions', label: 'Important Qs' },
    { value: 'topic-wise', label: 'Topic Wise' },
  ],
};

export default function StudyPage() {
  const token = useStore((state) => state.token);
  const user = useStore((state) => state.user);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [tool, setTool] = useState<StudyMaterial['material_type']>('summary');
  const [mode, setMode] = useState('exam');
  const [difficulty, setDifficulty] = useState('medium');
  const [count, setCount] = useState(10);
  const [query, setQuery] = useState('');
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<number[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [activeMaterialId, setActiveMaterialId] = useState<number | null>(null);
  const [flippedCards, setFlippedCards] = useState<Set<string>>(new Set());
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [testStartedAt, setTestStartedAt] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const id = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (mounted && !token) router.push('/login');
  }, [mounted, token, router]);

  useEffect(() => {
    if (!testStartedAt) return;
    const id = window.setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [testStartedAt]);

  const {
    data: documents = [],
    isLoading: isLoadingDocuments,
    error: documentsError,
  } = useQuery<DocumentItem[]>({
    queryKey: ['documents', user?.id],
    queryFn: async () => {
      const { data } = await api.get('/upload/');
      return data;
    },
    enabled: !!token && !!user,
  });

  const {
    data: groups = [],
    isLoading: isLoadingGroups,
    error: groupsError,
  } = useQuery<GroupItem[]>({
    queryKey: ['document-groups', user?.id],
    queryFn: async () => {
      const { data } = await api.get('/groups/');
      return data;
    },
    enabled: !!token && !!user,
  });

  useEffect(() => {
    if (selectedDocumentIds.length > 0 || selectedGroupIds.length > 0) return;
    const firstIndexedDocument = documents.find((document) => document.status === 'indexed' && (document.chunk_count || 0) > 0);
    if (!firstIndexedDocument) return;
    const id = window.setTimeout(() => setSelectedDocumentIds([firstIndexedDocument.id]), 0);
    return () => window.clearTimeout(id);
  }, [documents, selectedDocumentIds.length, selectedGroupIds.length]);

  const { data: materials = [] } = useQuery<StudyMaterial[]>({
    queryKey: ['study-materials', user?.id],
    queryFn: async () => {
      const { data } = await api.get('/study/materials');
      return data;
    },
    enabled: !!token && !!user,
  });

  const { data: activeMaterial } = useQuery<StudyMaterial>({
    queryKey: ['study-material', activeMaterialId],
    queryFn: async () => {
      const { data } = await api.get(`/study/materials/${activeMaterialId}`);
      return data;
    },
    enabled: !!token && !!activeMaterialId,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/study/generate', {
        tool,
        mode,
        difficulty,
        query,
        document_ids: selectedDocumentIds,
        group_ids: selectedGroupIds,
        count,
      });
      return data as StudyMaterial;
    },
    onSuccess: (material) => {
      setActiveMaterialId(material.id);
      setFlippedCards(new Set());
      setSelectedAnswers({});
      const now = Date.now();
      setTestStartedAt(now);
      setCurrentTime(now);
      queryClient.invalidateQueries({ queryKey: ['study-materials'] });
      queryClient.setQueryData(['study-material', material.id], material);
    },
  });

  const progressMutation = useMutation({
    mutationFn: async ({ itemId, payload }: { itemId: string; payload: Record<string, unknown> }) => {
      const { data } = await api.patch(`/study/materials/${activeMaterialId}/progress/${itemId}`, payload);
      return data as StudyMaterial;
    },
    onSuccess: (material) => {
      queryClient.setQueryData(['study-material', material.id], material);
      queryClient.invalidateQueries({ queryKey: ['study-materials'] });
    },
  });

  const activeDocs = useMemo(() => documents.filter((document) => selectedDocumentIds.includes(document.id)), [documents, selectedDocumentIds]);
  const activeGroups = useMemo(() => groups.filter((group) => selectedGroupIds.includes(group.id)), [groups, selectedGroupIds]);
  const questionCount = activeMaterial?.content?.questions?.length || 0;
  const answeredCount = Object.keys(selectedAnswers).length;
  const score = useMemo(() => {
    return (activeMaterial?.content?.questions || []).filter((question) => selectedAnswers[question.id] === question.correct_answer).length;
  }, [activeMaterial, selectedAnswers]);
  const elapsedSeconds = useMemo(() => {
    if (!testStartedAt || !currentTime) return 0;
    return Math.floor((currentTime - testStartedAt) / 1000);
  }, [testStartedAt, currentTime]);

  const toggleDocument = (id: number) => {
    setSelectedDocumentIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const toggleGroup = (id: number) => {
    setSelectedGroupIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const contextLoadError = documentsError || groupsError;
  const hasStudyContext = selectedDocumentIds.length > 0 || selectedGroupIds.length > 0;

  const flipCard = (id: string) => {
    setFlippedCards((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const shuffleCards = () => {
    const cards = activeMaterial?.content?.cards || [];
    if (!cards.length || !activeMaterial) return;
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    queryClient.setQueryData(['study-material', activeMaterial.id], {
      ...activeMaterial,
      content: { ...activeMaterial.content, cards: shuffled },
    });
  };

  const exportMaterial = async () => {
    if (!activeMaterial) return;
    const response = await api.get(`/study/materials/${activeMaterial.id}/export`, { responseType: 'blob' });
    const href = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = href;
    link.download = `${activeMaterial.title.replace(/[^a-z0-9_-]+/gi, '-').toLowerCase() || 'study-material'}.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
  };

  if (!mounted || !token) return null;

  return (
    <div className="flex h-dvh overflow-hidden bg-[#0B0F19] text-slate-100 selection:bg-orange-500/30">
      <Sidebar />

      <main className="flex min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 md:grid-cols-[360px_1fr] md:px-8 lg:px-10">
          <aside className="space-y-4">
            <section className="rounded-xl border border-white/8 bg-[#111827]/85 p-4 shadow-xl shadow-black/20">
              <div className="mb-4 flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-orange-500/10 ring-1 ring-orange-500/20">
                  <GraduationCap className="h-5 w-5 text-orange-300" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold">Study Tools</h1>
                  <p className="text-xs text-slate-500">Generate grounded exam prep material.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {toolOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        setTool(option.id);
                        setMode(modeOptions[option.id][0].value);
                      }}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                        tool === option.id
                          ? 'border-orange-400/40 bg-orange-500/15 text-orange-100'
                          : 'border-white/8 bg-white/[0.03] text-slate-400 hover:text-slate-100'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {option.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 grid gap-3">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Mode</label>
                <select
                  value={mode}
                  onChange={(event) => setMode(event.target.value)}
                  className="h-10 rounded-lg border border-white/10 bg-[#0B0F19] px-3 text-sm text-slate-200 outline-none focus:border-orange-400/50"
                >
                  {modeOptions[tool].map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                {(tool === 'mcq' || tool === 'flashcards') && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Difficulty</label>
                      <select
                        value={difficulty}
                        onChange={(event) => setDifficulty(event.target.value)}
                        className="h-10 w-full rounded-lg border border-white/10 bg-[#0B0F19] px-3 text-sm text-slate-200 outline-none focus:border-orange-400/50"
                      >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Count</label>
                      <input
                        type="number"
                        min={3}
                        max={40}
                        value={count}
                        onChange={(event) => setCount(Number(event.target.value))}
                        className="h-10 w-full rounded-lg border border-white/10 bg-[#0B0F19] px-3 text-sm text-slate-200 outline-none focus:border-orange-400/50"
                      />
                    </div>
                  </div>
                )}

                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Focus</label>
                <textarea
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  rows={3}
                  placeholder="Optional topic, chapter, or exam focus"
                  className="resize-none rounded-lg border border-white/10 bg-[#0B0F19] px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-orange-400/50"
                />
              </div>
            </section>

            <section className="rounded-xl border border-white/8 bg-[#111827]/85 p-4 shadow-xl shadow-black/20">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Library className="h-4 w-4 text-emerald-300" />
                Workspaces
              </div>
              <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
                {isLoadingGroups && <span className="text-xs text-slate-500">Loading workspaces...</span>}
                {!isLoadingGroups && groups.length === 0 && <span className="text-xs text-slate-600">No workspaces yet.</span>}
                {groups.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs transition ${
                      selectedGroupIds.includes(group.id)
                        ? 'border-emerald-300/40 bg-emerald-400/15 text-emerald-100'
                        : 'border-white/8 bg-white/[0.03] text-slate-400'
                    }`}
                  >
                    @{group.slug} · {group.doc_count || 0}
                  </button>
                ))}
              </div>
              <div className="mb-3 mt-5 flex items-center gap-2 text-sm font-semibold">
                <FileText className="h-4 w-4 text-orange-300" />
                Documents
              </div>
              <div className="max-h-48 space-y-2 overflow-y-auto">
                {isLoadingDocuments && <div className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 text-xs text-slate-500">Loading documents...</div>}
                {!isLoadingDocuments && documents.length === 0 && (
                  <div className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-3 text-xs leading-5 text-slate-500">
                    No indexed notes loaded for this session. Upload or reindex notes from the dashboard.
                  </div>
                )}
                {documents.map((document) => (
                  <button
                    key={document.id}
                    type="button"
                    onClick={() => toggleDocument(document.id)}
                    className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition ${
                      selectedDocumentIds.includes(document.id)
                        ? 'border-orange-400/40 bg-orange-500/15 text-orange-100'
                        : 'border-white/8 bg-white/[0.03] text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{document.filename}</span>
                    <span>{document.chunk_count || 0}</span>
                  </button>
                ))}
              </div>

              {contextLoadError && (
                <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-xs leading-5 text-red-200">
                  Could not load study context. Check that the backend is running on the configured API URL.
                </p>
              )}

              <Button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending || !hasStudyContext}
                className="mt-4 h-11 w-full rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 font-semibold text-white shadow-lg shadow-orange-500/20"
              >
                {generateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {hasStudyContext ? 'Generate' : 'Select a note first'}
              </Button>
              {!hasStudyContext && !isLoadingDocuments && (
                <Link href="/dashboard" className="mt-3 block text-center text-xs font-medium text-orange-300 hover:text-orange-200">
                  Upload or manage notes
                </Link>
              )}
              {generateMutation.error && (
                <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-xs text-red-200">
                  {(generateMutation.error as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Generation failed.'}
                </p>
              )}
            </section>

            <section className="rounded-xl border border-white/8 bg-[#111827]/85 p-3">
              <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Saved Materials</div>
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {materials.map((material) => (
                  <button
                    key={material.id}
                    type="button"
                    onClick={() => {
                      setActiveMaterialId(material.id);
                      setSelectedAnswers({});
                      const now = Date.now();
                      setTestStartedAt(now);
                      setCurrentTime(now);
                    }}
                    className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                      activeMaterialId === material.id
                        ? 'border-orange-400/40 bg-orange-500/10'
                        : 'border-white/8 bg-white/[0.03] hover:bg-white/[0.05]'
                    }`}
                  >
                    <div className="truncate text-sm font-medium text-slate-200">{material.title}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <span>{material.material_type}</span>
                      <span>·</span>
                      <span>{Math.round((material.confidence || 0) * 100)}% grounded</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </aside>

          <section className="min-w-0 rounded-xl border border-white/8 bg-[#111827]/70 shadow-2xl shadow-black/20">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-5 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-orange-300">
                  <BrainCircuit className="h-3.5 w-3.5" />
                  Revision Workspace
                </div>
                <h2 className="mt-1 truncate text-xl font-semibold text-slate-50">
                  {activeMaterial?.title || 'Generate your first study material'}
                </h2>
                {(activeDocs.length > 0 || activeGroups.length > 0) && (
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {[...activeGroups.map((group) => `@${group.slug}`), ...activeDocs.map((document) => document.filename)].join(' · ')}
                  </p>
                )}
              </div>
              {activeMaterial && (
                <button
                  type="button"
                  onClick={exportMaterial}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-slate-300 transition hover:text-white"
                >
                  <Download className="h-4 w-4" />
                  Export
                </button>
              )}
            </div>

            <div className="p-5">
              {!activeMaterial ? (
                <div className="grid min-h-[58vh] place-items-center text-center">
                  <div>
                    <div className="mx-auto grid h-16 w-16 place-items-center rounded-xl border border-orange-500/20 bg-orange-500/10">
                      <GraduationCap className="h-8 w-8 text-orange-300" />
                    </div>
                    <h3 className="mt-5 text-2xl font-semibold">Build exam-ready material</h3>
                    <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-400">
                      Select notes or workspaces, choose a study workflow, and DronaAI will generate grounded material from your uploaded context.
                    </p>
                  </div>
                </div>
              ) : activeMaterial.material_type === 'summary' ? (
                <SummaryView material={activeMaterial} />
              ) : activeMaterial.material_type === 'flashcards' ? (
                <FlashcardView
                  material={activeMaterial}
                  flippedCards={flippedCards}
                  onFlip={flipCard}
                  onShuffle={shuffleCards}
                  onMark={(itemId, marked) => progressMutation.mutate({ itemId, payload: { marked_difficult: marked, status: 'reviewing' } })}
                />
              ) : activeMaterial.material_type === 'mcq' ? (
                <MCQView
                  material={activeMaterial}
                  answers={selectedAnswers}
                  onAnswer={(questionId, answer) => {
                    setSelectedAnswers((current) => ({ ...current, [questionId]: answer }));
                    const question = activeMaterial.content?.questions?.find((item) => item.id === questionId);
                    progressMutation.mutate({ itemId: questionId, payload: { correct: answer === question?.correct_answer, status: 'attempted' } });
                  }}
                  answeredCount={answeredCount}
                  questionCount={questionCount}
                  score={score}
                  elapsedSeconds={elapsedSeconds}
                  onRetry={() => {
                    setSelectedAnswers({});
                    const now = Date.now();
                    setTestStartedAt(now);
                    setCurrentTime(now);
                  }}
                />
              ) : (
                <RevisionView material={activeMaterial} />
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function SummaryView({ material }: { material: StudyMaterial }) {
  const content = material.content || {};
  return (
    <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
      <nav className="hidden rounded-lg border border-white/8 bg-white/[0.03] p-3 lg:block">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Topics</div>
        <div className="space-y-1">
          {(content.sections || []).map((section, index) => (
            <a key={index} href={`#section-${index}`} className="block truncate rounded-md px-2 py-1.5 text-sm text-slate-400 hover:bg-white/[0.04] hover:text-slate-100">
              {section.heading}
            </a>
          ))}
        </div>
      </nav>
      <div className="space-y-4">
        {(content.sections || []).map((section, index) => (
          <details id={`section-${index}`} key={index} open={index < 2} className="rounded-lg border border-white/8 bg-white/[0.03] p-4">
            <summary className="cursor-pointer list-none text-lg font-semibold text-slate-100">{section.heading}</summary>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
              {section.bullets?.map((bullet, bulletIndex) => <li key={bulletIndex}>- {bullet}</li>)}
            </ul>
          </details>
        ))}
        {content.definitions && content.definitions.length > 0 && (
          <div className="rounded-lg border border-white/8 bg-white/[0.03] p-4">
            <h3 className="font-semibold text-slate-100">Definitions</h3>
            <div className="mt-3 grid gap-2">
              {content.definitions.map((item, index) => (
                <div key={index} className="rounded-md bg-[#0B0F19]/70 p-3 text-sm">
                  <span className="font-semibold text-orange-200">{item.term}: </span>
                  <span className="text-slate-300">{item.definition}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FlashcardView({
  material,
  flippedCards,
  onFlip,
  onShuffle,
  onMark,
}: {
  material: StudyMaterial;
  flippedCards: Set<string>;
  onFlip: (id: string) => void;
  onShuffle: () => void;
  onMark: (id: string, marked: boolean) => void;
}) {
  const cards = material.content?.cards || [];
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-slate-400">{cards.length} active-recall cards</div>
        <button onClick={onShuffle} className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-slate-300">
          <Shuffle className="h-4 w-4" />
          Shuffle
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card, index) => {
          const flipped = flippedCards.has(card.id);
          const marked = material.progress?.[card.id]?.marked_difficult;
          return (
            <div key={card.id || index} className="min-h-56 rounded-lg border border-white/8 bg-white/[0.03] p-4">
              <button type="button" onClick={() => onFlip(card.id)} className="flex h-36 w-full flex-col justify-center rounded-lg bg-[#0B0F19]/80 p-4 text-left transition hover:bg-[#0f1625]">
                <div className="mb-2 text-xs uppercase tracking-[0.12em] text-orange-300">{card.topic || card.type}</div>
                <div className="text-base font-medium leading-6 text-slate-100">{flipped ? card.back : card.front}</div>
              </button>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500">{flipped ? 'Answer' : 'Question'}</span>
                <button
                  type="button"
                  onClick={() => onMark(card.id, !marked)}
                  className={`rounded-full px-3 py-1 text-xs ${marked ? 'bg-red-500/15 text-red-200' : 'bg-white/[0.05] text-slate-400'}`}
                >
                  Difficult
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MCQView({
  material,
  answers,
  onAnswer,
  answeredCount,
  questionCount,
  score,
  elapsedSeconds,
  onRetry,
}: {
  material: StudyMaterial;
  answers: Record<string, string>;
  onAnswer: (questionId: string, answer: string) => void;
  answeredCount: number;
  questionCount: number;
  score: number;
  elapsedSeconds: number;
  onRetry: () => void;
}) {
  const questions = material.content?.questions || [];
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-white/8 bg-white/[0.03] p-3 text-sm text-slate-300">
        <span className="inline-flex items-center gap-2"><Timer className="h-4 w-4 text-orange-300" /> {Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, '0')}</span>
        <span>{answeredCount}/{questionCount} answered</span>
        <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-300" /> {score} correct</span>
        <button onClick={onRetry} className="ml-auto inline-flex items-center gap-2 rounded-lg bg-white/[0.05] px-3 py-1.5 text-xs">
          <RotateCcw className="h-3.5 w-3.5" />
          Retry
        </button>
      </div>
      <div className="space-y-4">
        {questions.map((question, index) => {
          const selected = answers[question.id];
          const answered = Boolean(selected);
          return (
            <div key={question.id || index} className="rounded-lg border border-white/8 bg-white/[0.03] p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs uppercase tracking-[0.12em] text-orange-300">Question {index + 1}</span>
                <span className="text-xs text-slate-500">{question.topic || question.type}</span>
              </div>
              <h3 className="text-base font-semibold leading-7 text-slate-100">{question.question}</h3>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {question.options.map((option) => {
                  const correct = option === question.correct_answer;
                  const wrong = answered && selected === option && !correct;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => onAnswer(question.id, option)}
                      disabled={answered}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
                        answered && correct
                          ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100'
                          : wrong
                            ? 'border-red-400/40 bg-red-500/10 text-red-100'
                            : 'border-white/8 bg-[#0B0F19]/70 text-slate-300 hover:bg-white/[0.05]'
                      }`}
                    >
                      {answered && correct && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                      {wrong && <XCircle className="h-4 w-4 shrink-0" />}
                      {option}
                    </button>
                  );
                })}
              </div>
              {answered && <p className="mt-3 rounded-lg bg-[#0B0F19]/70 p-3 text-sm leading-6 text-slate-300">{question.explanation}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RevisionView({ material }: { material: StudyMaterial }) {
  const content = material.content || {};
  const blocks = [
    { title: 'High Yield', items: content.high_yield, icon: Target },
    { title: 'Formula Sheet', items: content.formula_sheet, icon: BrainCircuit },
    { title: 'Important Questions', items: content.important_questions, icon: ClipboardList },
    { title: 'Revision Order', items: content.revision_order, icon: GraduationCap },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {blocks.map((block) => {
        const Icon = block.icon;
        if (!block.items?.length) return null;
        return (
          <div key={block.title} className="rounded-lg border border-white/8 bg-white/[0.03] p-4">
            <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-100">
              <Icon className="h-4 w-4 text-orange-300" />
              {block.title}
            </h3>
            <ul className="space-y-2 text-sm leading-6 text-slate-300">
              {block.items.map((item, index) => <li key={index}>- {item}</li>)}
            </ul>
          </div>
        );
      })}
      {content.concept_map && content.concept_map.length > 0 && (
        <div className="rounded-lg border border-white/8 bg-white/[0.03] p-4 lg:col-span-2">
          <h3 className="mb-3 font-semibold text-slate-100">Concept Map</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {content.concept_map.map((item, index) => (
              <div key={index} className="rounded-lg bg-[#0B0F19]/70 p-3">
                <div className="font-medium text-orange-200">{item.topic}</div>
                <div className="mt-1 text-sm text-slate-400">{item.links?.join(' · ')}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
