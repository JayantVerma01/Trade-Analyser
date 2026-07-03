import { apiClient } from './client';
import type { TheoryDocument, ApiResponse } from '@/types';

export const documentsApi = {
  upload: async (file: File): Promise<TheoryDocument> => {
    const form = new FormData();
    form.append('file', file);
    const { data } = await apiClient.post<ApiResponse<TheoryDocument>>(
      '/documents/upload',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return data.data;
  },

  list: async (): Promise<TheoryDocument[]> => {
    const { data } = await apiClient.get<ApiResponse<TheoryDocument[]>>('/documents');
    return data.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/documents/${id}`);
  },

  reprocess: async (id: string): Promise<TheoryDocument> => {
    const { data } = await apiClient.post<ApiResponse<TheoryDocument>>(
      `/documents/${id}/reprocess`
    );
    return data.data;
  },
};
