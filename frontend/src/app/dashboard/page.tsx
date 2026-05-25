'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { api } from '@/services/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BrainCircuit, BookOpen, Clock, Activity, Loader2, Library, Plus, Trash2, Target, Sparkles } from 'lucide-react';
import { motion, type Variants } from 'framer-motion';
import Sidebar from '@/components/Sidebar';
import UploadDropzone from '@/components/UploadDropzone';
import DocumentCard from '@/components/DocumentCard';
import { formatTimestamp } from '@/lib/formatDate';

interface Document {
  id: number;
  filename: string;
  created_at: string;
  updated_at?: string;
  status?: string;
  chunk_count?: number;
}

interface Group {
  id: number;
  name: string;
  slug: string;
  color?: string;
  doc_count: number;
  documents?: Document[];
  updated_at?: string;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

export default function DashboardPage() {
  const token = useStore((state) => state.token);
  const user = useStore((state) => state.user);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [uploadError, setUploadError] = useState('');
  const [mounted, setMounted] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<number[]>([]);

  useEffect(() => {
    const id = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (mounted && !token) {
      router.push('/login');
    }
  }, [token, router, mounted]);

  const { data: documents, isLoading: isLoadingDocs } = useQuery<Document[]>({
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

  const { data: groups = [] } = useQuery<Group[]>({
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

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/upload/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: (document: Document) => {
      queryClient.setQueryData<Document[]>(['documents', user?.id], (current = []) => [
        document,
        ...current.filter((item) => item.id !== document.id),
      ]);
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['document-groups'] });
    },
    onError: (error: unknown) => {
      const apiError = error as { response?: { data?: { detail?: string } } };
      setUploadError(apiError.response?.data?.detail || 'Failed to upload document');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.delete(`/upload/${id}`);
      return data;
    },
    onMutate: async (id: number) => {
      await queryClient.cancelQueries({ queryKey: ['documents', user?.id] });
      const previousDocuments = queryClient.getQueryData<Document[]>(['documents', user?.id]);
      queryClient.setQueryData<Document[]>(['documents', user?.id], (current = []) =>
        current.filter((document) => document.id !== id)
      );
      return { previousDocuments };
    },
    onError: (_error, _id, context) => {
      if (context?.previousDocuments) {
        queryClient.setQueryData(['documents', user?.id], context.previousDocuments);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['document-groups'] });
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/groups/', {
        name: newGroupName.trim(),
        document_ids: selectedDocumentIds,
      });
      return data;
    },
    onSuccess: () => {
      setNewGroupName('');
      setSelectedDocumentIds([]);
      queryClient.invalidateQueries({ queryKey: ['document-groups'] });
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/groups/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-groups'] });
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
    },
  });

  const handleDrop = (acceptedFiles: File[]) => {
    setUploadError('');
    if (acceptedFiles.length > 0) {
      uploadMutation.mutate(acceptedFiles[0]);
    }
  };

  if (!mounted || !token) return null;

  const latestDocumentUpdate = documents?.reduce<string | undefined>((latest, document) => {
    const value = document.updated_at || document.created_at;
    if (!latest) return value;
    return new Date(value).getTime() > new Date(latest).getTime() ? value : latest;
  }, undefined);

  return (
    <div className="learning-shell">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="page-wrap">
          
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end"
          >
            <div>
              <div className="section-kicker mb-3">
                <Sparkles className="h-4 w-4" />
                Premium study command center
              </div>
              <h1 className="font-heading mb-3 text-4xl font-bold tracking-normal text-slate-50 md:text-5xl">Welcome back</h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-300">Build your AI study workspace, organize source material, and turn notes into exam-ready learning flows.</p>
            </div>
            <div className="success-chip">
              <Activity className="h-4 w-4" />
              <span>Learning engine online</span>
            </div>
          </motion.div>

          <motion.div variants={containerVariants} initial="hidden" animate="show" className="mb-6 grid gap-4 md:grid-cols-3">
            {[
              { icon: Target, label: 'Active focus', value: groups.length ? `${groups.length} study spaces` : 'No spaces yet', tone: 'text-cyan-200' },
              { icon: BrainCircuit, label: 'AI readiness', value: documents?.length ? 'Context ready' : 'Needs notes', tone: 'text-orange-200' },
              { icon: Clock, label: 'Last update', value: latestDocumentUpdate ? formatTimestamp(latestDocumentUpdate) : 'Start today', tone: 'text-emerald-200' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <motion.div key={item.label} variants={itemVariants} className="premium-panel-soft p-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-800 ring-1 ring-slate-700">
                      <Icon className={`h-5 w-5 ${item.tone}`} />
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{item.label}</div>
                      <div className="mt-1 font-heading text-lg font-semibold text-slate-50">{item.value}</div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>

          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:grid-cols-4"
          >
            {/* Stats Card */}
            <motion.div variants={itemVariants} className="col-span-1">
              <Card className="premium-panel h-full transition duration-300 hover:border-orange-400/30">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-400">
                    <BookOpen className="h-4 w-4 text-orange-300" />
                    Total Documents
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="font-heading text-5xl font-bold text-slate-50">{documents?.length || 0}</div>
                  <p className="mt-3 flex items-center gap-1 text-xs font-medium text-slate-500">
                    <Clock className="h-3 w-3" /> {latestDocumentUpdate ? formatTimestamp(latestDocumentUpdate) : 'No documents yet'}
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            {/* Upload Card */}
            <motion.div variants={itemVariants} className="col-span-1 md:col-span-2 lg:col-span-3">
              <Card className="premium-panel h-full border-t-2 border-t-orange-400/40">
                <CardHeader>
                  <CardTitle className="font-heading text-xl font-semibold text-slate-50">Intelligent Ingestion</CardTitle>
                  <CardDescription className="text-slate-400">Upload materials to create a searchable learning base for tutoring, revision, flashcards, and citations.</CardDescription>
                </CardHeader>
                <CardContent>
                  <UploadDropzone 
                    onDrop={handleDrop} 
                    isPending={uploadMutation.isPending} 
                    error={uploadError} 
                  />
                </CardContent>
              </Card>
            </motion.div>

            {/* Documents List */}
            <motion.div variants={itemVariants} className="col-span-1 md:col-span-3 lg:col-span-4 mt-6">
              <Card className="premium-panel mb-6">
                <CardHeader>
                  <CardTitle className="font-heading flex items-center gap-2 text-xl font-semibold text-slate-50">
                    <Library className="h-5 w-5 text-emerald-300" />
                    Workspaces
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Group notes into focused study spaces and mention them in chat with @.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-3 md:flex-row">
                    <input
                      value={newGroupName}
                      onChange={(event) => setNewGroupName(event.target.value)}
                      placeholder="Create @workspace, e.g. nlp-notes"
                      className="smart-input h-11 flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => createGroupMutation.mutate()}
                      disabled={!newGroupName.trim() || createGroupMutation.isPending}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-bold text-white shadow-lg shadow-emerald-950/20 transition hover:-translate-y-0.5 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {createGroupMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      Create Workspace
                    </button>
                  </div>
                  {documents && documents.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {documents.map((document) => {
                        const selected = selectedDocumentIds.includes(document.id);
                        return (
                          <button
                            key={document.id}
                            type="button"
                            onClick={() =>
                              setSelectedDocumentIds((current) =>
                                selected ? current.filter((id) => id !== document.id) : [...current, document.id]
                              )
                            }
                            className={`rounded-full border px-3 py-1.5 text-xs transition ${
                              selected
                                ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100'
                                : 'border-slate-700 bg-[#0B1220]/60 text-slate-400 hover:text-slate-100'
                            }`}
                          >
                            {document.filename}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {groups.length > 0 && (
                    <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {groups.map((group) => (
                        <div key={group.id} className="study-card">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-heading truncate font-semibold text-slate-50">@{group.slug}</div>
                              <div className="mt-1 text-xs text-slate-500">{group.doc_count} docs</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => deleteGroupMutation.mutate(group.id)}
                              className="rounded-lg p-1.5 text-slate-500 transition hover:bg-red-500/10 hover:text-red-400"
                              aria-label={`Delete ${group.name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="mt-3 space-y-1">
                            {group.documents?.slice(0, 3).map((document) => (
                              <div key={document.id} className="truncate text-xs text-slate-500">
                                {document.filename}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="premium-panel flex min-h-[400px] flex-col">
                <CardHeader>
                  <CardTitle className="font-heading flex items-center gap-2 text-xl font-semibold text-slate-50">
                    <BrainCircuit className="h-5 w-5 text-orange-300" />
                    Indexed Materials
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                  {isLoadingDocs ? (
                    <div className="flex flex-col items-center justify-center h-40 space-y-4">
                      <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
                    </div>
                  ) : documents?.length === 0 ? (
                    <div className="mx-2 flex h-48 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-700 bg-[#0B1220]/50 text-center text-slate-500">
                      <BookOpen className="mb-3 h-9 w-9 text-orange-300/70" />
                      <p className="font-heading text-lg font-semibold text-slate-200">Start building your AI study workspace</p>
                      <p className="mt-1 text-sm">Upload notes to generate revision material.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {documents?.map((doc) => (
                        <DocumentCard 
                          key={doc.id} 
                          id={doc.id}
                          filename={doc.filename}
                          createdAt={doc.created_at}
                          isDeleting={deleteMutation.isPending && deleteMutation.variables === doc.id}
                          onDelete={(id) => deleteMutation.mutate(id)}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
