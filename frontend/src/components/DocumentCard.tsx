'use client';

import { FileText, Trash2, Loader2, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatTimestamp } from '@/lib/formatDate';

interface DocumentCardProps {
  id: number;
  filename: string;
  createdAt: string;
  isDeleting: boolean;
  onDelete: (id: number) => void;
}

export default function DocumentCard({ id, filename, createdAt, isDeleting, onDelete }: DocumentCardProps) {
  return (
    <div className="group relative flex items-center justify-between overflow-hidden rounded-2xl border border-slate-700/70 bg-[#111827] p-4 shadow-lg shadow-black/10 transition-all duration-300 hover:-translate-y-0.5 hover:border-orange-400/30 hover:bg-[#172033]">
      <div className="flex items-center gap-4 overflow-hidden">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 ring-1 ring-orange-400/25">
          <FileText className="h-5 w-5 text-orange-300" />
        </div>
        <div className="flex flex-col overflow-hidden">
          <span className="truncate pr-4 font-semibold text-slate-100">{filename}</span>
          <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <Calendar className="h-3 w-3" />
            {formatTimestamp(createdAt)}
          </div>
        </div>
      </div>
      
      <Button 
        variant="ghost" 
        size="icon" 
        className="absolute right-4 h-8 w-8 text-slate-500 opacity-0 transition-opacity hover:bg-red-400/10 hover:text-red-300 group-hover:opacity-100"
        onClick={() => onDelete(id)}
        disabled={isDeleting}
      >
        {isDeleting ? (
          <Loader2 className="h-4 w-4 animate-spin text-red-400" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
