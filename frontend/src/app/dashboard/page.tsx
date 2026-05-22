'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { api } from '@/services/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BrainCircuit, BookOpen, Clock, Activity, Loader2 } from 'lucide-react';
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const [uploadError, setUploadError] = useState('');
  const [mounted, setMounted] = useState(false);

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
    queryKey: ['documents'],
    queryFn: async () => {
      const { data } = await api.get('/upload/');
      return data;
    },
    enabled: !!token,
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
      queryClient.setQueryData<Document[]>(['documents'], (current = []) => [
        document,
        ...current.filter((item) => item.id !== document.id),
      ]);
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
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
      await queryClient.cancelQueries({ queryKey: ['documents'] });
      const previousDocuments = queryClient.getQueryData<Document[]>(['documents']);
      queryClient.setQueryData<Document[]>(['documents'], (current = []) =>
        current.filter((document) => document.id !== id)
      );
      return { previousDocuments };
    },
    onError: (_error, _id, context) => {
      if (context?.previousDocuments) {
        queryClient.setQueryData(['documents'], context.previousDocuments);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
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
    <div className="flex h-screen bg-[#0B0F19] overflow-hidden selection:bg-orange-500/30">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="p-8 lg:p-12 max-w-7xl mx-auto w-full">
          
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10 flex items-end justify-between"
          >
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-slate-100 mb-2">Welcome back</h1>
              <p className="text-slate-400 text-lg">Manage your study materials and track your AI interactions.</p>
            </div>
            <div className="hidden md:flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-full border border-emerald-500/20">
              <Activity className="h-4 w-4" />
              <span className="text-sm font-medium">System Online</span>
            </div>
          </motion.div>

          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6"
          >
            {/* Stats Card */}
            <motion.div variants={itemVariants} className="col-span-1">
              <Card className="bg-[#111827]/80 backdrop-blur-md border-white/5 shadow-2xl h-full hover:bg-[#1E293B] transition-colors duration-300">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-orange-400" />
                    Total Documents
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-slate-100">{documents?.length || 0}</div>
                  <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {latestDocumentUpdate ? formatTimestamp(latestDocumentUpdate) : 'No documents yet'}
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            {/* Upload Card */}
            <motion.div variants={itemVariants} className="col-span-1 md:col-span-2 lg:col-span-3">
              <Card className="bg-[#111827]/80 backdrop-blur-md border-white/5 shadow-2xl h-full border-t border-t-orange-500/20">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-slate-100">Intelligent Ingestion</CardTitle>
                  <CardDescription className="text-slate-400">Upload materials to instantly chunk, embed, and index them via our FAISS RAG pipeline.</CardDescription>
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
              <Card className="bg-[#111827]/80 backdrop-blur-md border-white/5 shadow-2xl flex flex-col min-h-[400px]">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                    <BrainCircuit className="h-5 w-5 text-orange-400" />
                    Indexed Materials
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                  {isLoadingDocs ? (
                    <div className="flex flex-col items-center justify-center h-40 space-y-4">
                      <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                    </div>
                  ) : documents?.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-slate-500 border-2 border-dashed border-white/5 rounded-2xl mx-2">
                      <BookOpen className="h-8 w-8 mb-2 opacity-50" />
                      <p className="text-sm">No documents found. Upload one to get started.</p>
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
