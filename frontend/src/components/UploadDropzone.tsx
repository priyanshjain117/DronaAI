'use client';

import { useDropzone } from 'react-dropzone';
import { UploadCloud, Loader2 } from 'lucide-react';

interface UploadDropzoneProps {
  onDrop: (acceptedFiles: File[]) => void;
  isPending: boolean;
  error?: string;
}

export default function UploadDropzone({ onDrop, isPending, error }: UploadDropzoneProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt']
    },
    maxFiles: 1,
  });

  return (
    <div className="flex flex-col gap-4">
      <div
        {...getRootProps()} 
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-300 sm:p-12 ${
          isDragActive 
            ? 'border-orange-400 bg-orange-500/10 shadow-[0_0_34px_rgba(249,115,22,0.18)]' 
            : 'border-slate-600 bg-[#0B1220]/55 hover:border-orange-400/35 hover:bg-[#0B1220]/80'
        }`}
      >
        <input {...getInputProps()} />
        {isPending ? (
          <div className="flex flex-col items-center animate-in fade-in">
            <Loader2 className="mb-4 h-10 w-10 animate-spin text-orange-400" />
            <p className="text-sm font-semibold text-slate-300">Building your study index...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className={`mb-4 rounded-2xl p-4 transition-colors ${isDragActive ? 'bg-orange-500/20 text-orange-300' : 'bg-slate-800 text-cyan-200'}`}>
              <UploadCloud className="h-8 w-8" />
            </div>
            <p className="font-heading text-lg font-semibold text-slate-50">
              {isDragActive ? "Drop to create study material" : "Upload notes, lectures, or PDFs"}
            </p>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">DronaAI will parse, chunk, and prepare them for chat, revision, flashcards, and exam practice.</p>
          </div>
        )}
      </div>
      {error && (
        <div className="animate-in fade-in slide-in-from-top-2 flex items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}
    </div>
  );
}
