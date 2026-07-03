'use client';

import { useCallback, useState } from 'react';
import { Upload, FileText, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn, formatBytes } from '@/lib/utils';
import { documentsApi } from '@/lib/api/documents.api';
import { useToast } from '@/hooks/use-toast';
import type { TheoryDocument } from '@/types';

interface UploadFile {
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
  doc?: TheoryDocument;
}

interface Props {
  onUploaded: (doc: TheoryDocument) => void;
}

const ACCEPTED = '.pdf,.txt';
const MAX_MB = 20;

export default function DocumentUpload({ onUploaded }: Props) {
  const { toast } = useToast();
  const [uploads, setUploads] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const updateUpload = (idx: number, patch: Partial<UploadFile>) => {
    setUploads((prev) => prev.map((u, i) => (i === idx ? { ...u, ...patch } : u)));
  };

  const processFile = async (file: File, idx: number) => {
    if (file.size > MAX_MB * 1024 * 1024) {
      updateUpload(idx, { status: 'error', error: `File exceeds ${MAX_MB}MB limit` });
      return;
    }

    updateUpload(idx, { status: 'uploading', progress: 30 });

    try {
      const doc = await documentsApi.upload(file);
      updateUpload(idx, { status: 'done', progress: 100, doc });
      onUploaded(doc);
      toast({ title: 'Uploaded!', description: `${file.name} — processing started` });
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Upload failed';
      updateUpload(idx, { status: 'error', error: msg, progress: 0 });
      toast({ variant: 'destructive', title: 'Upload failed', description: msg });
    }
  };

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const arr = Array.from(files);
      const startIdx = uploads.length;
      const newUploads: UploadFile[] = arr.map((f) => ({
        file: f,
        status: 'pending',
        progress: 0,
      }));
      setUploads((prev) => [...prev, ...newUploads]);
      arr.forEach((f, i) => processFile(f, startIdx + i));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uploads.length]
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      addFiles(e.target.files);
      e.target.value = '';
    }
  };

  const remove = (idx: number) => {
    setUploads((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50 hover:bg-secondary/50'
        )}
        onClick={() => document.getElementById('doc-file-input')?.click()}
      >
        <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm font-medium">Drag & drop your theory documents here</p>
        <p className="text-xs text-muted-foreground mt-1">
          Supports PDF and TXT · Max {MAX_MB}MB per file
        </p>
        <Button variant="outline" size="sm" className="mt-4" onClick={(e) => e.stopPropagation()}>
          <label htmlFor="doc-file-input" className="cursor-pointer">Browse files</label>
        </Button>
        <input
          id="doc-file-input"
          type="file"
          accept={ACCEPTED}
          multiple
          className="hidden"
          onChange={handleFileInput}
        />
      </div>

      {/* Upload queue */}
      {uploads.length > 0 && (
        <ul className="space-y-2">
          {uploads.map((u, idx) => (
            <li
              key={idx}
              className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card"
            >
              <FileText className="h-5 w-5 text-muted-foreground shrink-0" />

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{u.file.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(u.file.size)}</p>
                {u.status === 'uploading' && (
                  <Progress value={u.progress} className="mt-1.5 h-1" />
                )}
                {u.status === 'error' && (
                  <p className="text-xs bear-text mt-0.5">{u.error}</p>
                )}
              </div>

              {u.status === 'uploading' && (
                <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
              )}
              {u.status === 'done' && (
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              )}
              {u.status === 'error' && (
                <AlertCircle className="h-4 w-4 bear-text shrink-0" />
              )}
              {u.status !== 'uploading' && (
                <button
                  onClick={() => remove(idx)}
                  className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
