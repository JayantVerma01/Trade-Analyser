'use client';

import { useState } from 'react';
import { FileText, Trash2, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { documentsApi } from '@/lib/api/documents.api';
import { useToast } from '@/hooks/use-toast';
import { formatBytes, formatDate } from '@/lib/utils';
import type { TheoryDocument, DocumentStatus } from '@/types';

const STATUS_LABELS: Record<DocumentStatus, string> = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  READY: 'Ready',
  FAILED: 'Failed',
};

const STATUS_VARIANT: Record<DocumentStatus, 'pending' | 'processing' | 'ready' | 'failed'> = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  READY: 'ready',
  FAILED: 'failed',
};

interface Props {
  documents: TheoryDocument[];
  onRefresh: () => void;
}

export default function DocumentList({ documents, onRefresh }: Props) {
  const { toast } = useToast();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This will also remove its embeddings.`)) return;
    setLoadingId(id);
    try {
      await documentsApi.delete(id);
      toast({ title: 'Deleted', description: `${name} removed` });
      onRefresh();
    } catch {
      toast({ variant: 'destructive', title: 'Delete failed' });
    } finally {
      setLoadingId(null);
    }
  };

  const handleReprocess = async (id: string, name: string) => {
    setLoadingId(id);
    try {
      await documentsApi.reprocess(id);
      toast({ title: 'Reprocessing started', description: name });
      onRefresh();
    } catch {
      toast({ variant: 'destructive', title: 'Reprocess failed' });
    } finally {
      setLoadingId(null);
    }
  };

  if (documents.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
        <p className="text-xs text-muted-foreground mt-1">
          Upload your trading theory PDFs above to enable RAG-powered Q&A.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {documents.map((doc) => {
        const isLoading = loadingId === doc.id;
        return (
          <Card key={doc.id} className="hover:border-border/80 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                {/* Icon */}
                <div className="p-2 rounded-lg bg-secondary shrink-0">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium truncate">{doc.originalName}</p>
                    <Badge variant={STATUS_VARIANT[doc.status]}>
                      {doc.status === 'PROCESSING' && (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      )}
                      {STATUS_LABELS[doc.status]}
                    </Badge>
                    {doc.status === 'READY' && (
                      <span className="text-xs text-muted-foreground flex items-center gap-2">
                        <span>{doc.chunkCount} chunks</span>
                        {(doc.imageChunkCount ?? 0) > 0 && (
                          <span className="text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded text-[10px] font-medium">
                            👁 {doc.imageChunkCount} visual{doc.imageChunkCount! > 1 ? 's' : ''}
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatBytes(doc.fileSize)} · {formatDate(doc.createdAt)}
                  </p>
                  {doc.errorMessage && (
                    <p className="text-xs bear-text mt-0.5">{doc.errorMessage}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {doc.status === 'FAILED' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={isLoading}
                      onClick={() => handleReprocess(doc.id, doc.originalName)}
                      title="Retry processing"
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:text-destructive"
                    disabled={isLoading}
                    onClick={() => handleDelete(doc.id, doc.originalName)}
                    title="Delete document"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
