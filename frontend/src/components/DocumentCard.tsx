'use client';

import { FileText, Trash2, Loader2, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';

interface DocumentCardProps {
  id: number;
  filename: string;
  createdAt: string;
  isDeleting: boolean;
  onDelete: (id: number) => void;
}

export default function DocumentCard({ id, filename, createdAt, isDeleting, onDelete }: DocumentCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-xl bg-slate-800/20 hover:bg-slate-800/40 border border-white/5 hover:border-white/10 transition-all duration-300 p-4 flex items-center justify-between">
      <div className="flex items-center gap-4 overflow-hidden">
        <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
          <FileText className="h-5 w-5 text-blue-400" />
        </div>
        <div className="flex flex-col overflow-hidden">
          <span className="font-medium text-slate-200 truncate pr-4">{filename}</span>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
            <Calendar className="h-3 w-3" />
            {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
          </div>
        </div>
      </div>
      
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-8 w-8 text-slate-500 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-opacity absolute right-4"
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
