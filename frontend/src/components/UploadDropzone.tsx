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
        className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 ${
          isDragActive 
            ? 'border-orange-500 bg-orange-500/10 shadow-[0_0_30px_rgba(249,115,22,0.15)]' 
            : 'border-white/10 hover:border-white/20 hover:bg-white/[0.02]'
        }`}
      >
        <input {...getInputProps()} />
        {isPending ? (
          <div className="flex flex-col items-center animate-in fade-in">
            <Loader2 className="h-10 w-10 text-orange-500 animate-spin mb-4" />
            <p className="text-sm text-slate-400 font-medium">Processing document securely...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className={`p-4 rounded-full mb-4 transition-colors ${isDragActive ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-800/50 text-slate-400'}`}>
              <UploadCloud className="h-8 w-8" />
            </div>
            <p className="text-base font-medium text-slate-200">
              {isDragActive ? "Drop file to securely upload" : "Click to upload or drag and drop"}
            </p>
            <p className="text-sm text-slate-500 mt-2">Supports PDF and TXT (Max 10MB)</p>
          </div>
        )}
      </div>
      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center justify-center animate-in fade-in slide-in-from-top-2">
          {error}
        </div>
      )}
    </div>
  );
}
