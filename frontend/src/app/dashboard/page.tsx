'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { api } from '@/services/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BrainCircuit, UploadCloud, FileText, Loader2, MessageSquare, LogOut, Trash2 } from 'lucide-react';
import Link from 'next/link';

interface Document {
  id: number;
  filename: string;
  created_at: string;
}

export default function DashboardPage() {
  const token = useStore((state) => state.token);
  const logout = useStore((state) => state.logout);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    if (!token) {
      router.push('/login');
    }
  }, [token, router]);

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

  const onDrop = (acceptedFiles: File[]) => {
    setUploadError('');
    if (acceptedFiles.length > 0) {
      uploadMutation.mutate(acceptedFiles[0]);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt']
    },
    maxFiles: 1,
  });

  if (!token) return null;

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950">
      <header className="px-6 h-16 flex items-center border-b border-white/10 bg-black/50 sticky top-0 z-50">
        <Link className="flex items-center gap-2" href="/dashboard">
          <BrainCircuit className="h-6 w-6 text-indigo-500" />
          <span className="font-bold text-xl tracking-tighter">DronaAI</span>
        </Link>
        <div className="ml-auto flex items-center gap-4">
          <Link href="/chat">
            <Button variant="outline" className="border-white/10 hover:bg-white/5">
              <MessageSquare className="h-4 w-4 mr-2" />
              Chat
            </Button>
          </Link>
          <Button variant="ghost" onClick={() => { logout(); router.push('/'); }}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="flex-1 p-6 lg:p-12 max-w-6xl mx-auto w-full grid gap-8 md:grid-cols-[1fr_300px]">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Dashboard</h1>
            <p className="text-zinc-400">Upload and manage your study materials.</p>
          </div>

          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle>Upload New Material</CardTitle>
              <CardDescription>Drag and drop your PDF or TXT files here.</CardDescription>
            </CardHeader>
            <CardContent>
              <div 
                {...getRootProps()} 
                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
                  isDragActive ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/10 hover:border-white/20 hover:bg-white/[0.02]'
                }`}
              >
                <input {...getInputProps()} />
                {uploadMutation.isPending ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="h-10 w-10 text-indigo-500 animate-spin mb-4" />
                    <p className="text-sm text-zinc-400">Uploading and processing document...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="p-4 bg-white/5 rounded-full mb-4">
                      <UploadCloud className="h-8 w-8 text-indigo-400" />
                    </div>
                    <p className="text-base font-medium">Click to upload or drag and drop</p>
                    <p className="text-sm text-zinc-400 mt-1">PDF or TXT (max. 10MB)</p>
                  </div>
                )}
              </div>
              {uploadError && (
                <p className="text-red-400 text-sm mt-4 text-center">{uploadError}</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-white/5 border-white/10 h-[calc(100vh-12rem)] flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-400" />
                Your Documents
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
              <ScrollArea className="h-full px-6 pb-6">
                {isLoadingDocs ? (
                  <div className="flex justify-center p-4">
                    <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
                  </div>
                ) : documents?.length === 0 ? (
                  <p className="text-sm text-zinc-400 text-center py-8">No documents uploaded yet.</p>
                ) : (
                  <div className="space-y-3">
                    {documents?.map((doc) => (
                      <div key={doc.id} className="p-3 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors flex items-center justify-between gap-4 group">
                        <div className="flex flex-col gap-1 overflow-hidden">
                          <span className="text-sm font-medium truncate" title={doc.filename}>{doc.filename}</span>
                          <span className="text-xs text-zinc-500">{new Date(doc.created_at).toLocaleDateString()}</span>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => deleteMutation.mutate(doc.id)}
                          disabled={deleteMutation.isPending}
                        >
                          {deleteMutation.isPending && deleteMutation.variables === doc.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
