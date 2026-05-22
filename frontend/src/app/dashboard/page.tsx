'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { api } from '@/services/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BrainCircuit, BookOpen, Clock, Activity, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import Sidebar from '@/components/Sidebar';
import UploadDropzone from '@/components/UploadDropzone';
import DocumentCard from '@/components/DocumentCard';
import Link from 'next/link';

interface Document {
  id: number;
  filename: string;
  created_at: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
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
    setMounted(true);
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (error: any) => {
      setUploadError(error.response?.data?.detail || 'Failed to upload document');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.delete(`/upload/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    }
  });

  const handleDrop = (acceptedFiles: File[]) => {
    setUploadError('');
    if (acceptedFiles.length > 0) {
      uploadMutation.mutate(acceptedFiles[0]);
    }
  };

  if (!mounted || !token) return null;

  return (
    <div className="flex h-screen bg-[#0A0F1C] overflow-hidden selection:bg-blue-500/30">
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
            <div className="hidden md:flex items-center gap-2 bg-blue-500/10 text-blue-400 px-4 py-2 rounded-full border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
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
            {/* Bento Grid: Stats Cards */}
            <motion.div variants={itemVariants} className="col-span-1 md:col-span-1 lg:col-span-1">
              <Card className="bg-[#111827]/80 backdrop-blur-md border-white/5 shadow-2xl h-full hover:bg-[#161F32] transition-colors duration-300">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-blue-400" />
                    Total Documents
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-slate-100">{documents?.length || 0}</div>
                  <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Updated just now
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            {/* Bento Grid: Upload Card */}
            <motion.div variants={itemVariants} className="col-span-1 md:col-span-2 lg:col-span-3">
              <Card className="bg-[#111827]/80 backdrop-blur-md border-white/5 shadow-2xl h-full border-t border-t-blue-500/20">
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

            {/* Bento Grid: Documents List */}
            <motion.div variants={itemVariants} className="col-span-1 md:col-span-3 lg:col-span-4 mt-6">
              <Card className="bg-[#111827]/80 backdrop-blur-md border-white/5 shadow-2xl flex flex-col min-h-[400px]">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                    <BrainCircuit className="h-5 w-5 text-indigo-400" />
                    Indexed Materials
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 p-0">
                  <ScrollArea className="h-[350px] px-6 pb-6">
                    {isLoadingDocs ? (
                      <div className="flex flex-col items-center justify-center h-40 space-y-4">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
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
                  </ScrollArea>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
