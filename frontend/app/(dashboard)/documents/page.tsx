'use client';

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import DocumentUpload from '@/components/documents/DocumentUpload';
import DocumentList from '@/components/documents/DocumentList';
import { documentsApi } from '@/lib/api/documents.api';
import type { TheoryDocument } from '@/types';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<TheoryDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true);
    try {
      const docs = await documentsApi.list();
      setDocuments(docs);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
    // Poll every 5s to update PROCESSING → READY status
    const interval = setInterval(fetchDocuments, 5000);
    return () => clearInterval(interval);
  }, [fetchDocuments]);

  const handleUploaded = (doc: TheoryDocument) => {
    setDocuments((prev) => [doc, ...prev]);
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Theory Documents</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Upload your trading PDFs. The AI will extract, chunk, and embed them for RAG-powered Q&A.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchDocuments} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Upload Documents</CardTitle>
          <CardDescription>
            Supported: PDF, TXT · Max 20 MB per file · Multiple files allowed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DocumentUpload onUploaded={handleUploaded} />
        </CardContent>
      </Card>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Your Documents ({documents.length})
        </h2>
        <DocumentList documents={documents} onRefresh={fetchDocuments} />
      </div>
    </div>
  );
}
