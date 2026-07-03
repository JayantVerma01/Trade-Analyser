import { apiClient } from './client';
import type { TheoryChatResponse, ChatMessage, ApiResponse } from '@/types';

export const chatApi = {
  theoryChat: async (
    message: string,
    sessionId: string,
    history: ChatMessage[]
  ): Promise<TheoryChatResponse> => {
    const { data } = await apiClient.post<ApiResponse<TheoryChatResponse>>('/chat/theory', {
      message,
      sessionId,
      history,
    });
    return data.data;
  },
};
