import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Session APIs
export const sessionsApi = {
  create: (data: { therapistId: string; clientId: string; startTime: string }) =>
    api.post('/sessions', data),
  
  getAll: (therapistId?: string) =>
    api.get('/sessions', { params: { therapistId } }),
  
  getOne: (sessionId: string) =>
    api.get(`/sessions/${sessionId}`),
  
  addEntry: (sessionId: string, data: { speaker: string; content: string; timestamp: string }) =>
    api.post(`/sessions/${sessionId}/entries`, data),
  
  getSummary: (sessionId: string) =>
    api.get(`/sessions/${sessionId}/summary`),
};

// Transcription APIs
export const transcriptionApi = {
  transcribe: (sessionId: string, audioFile: File) => {
    const formData = new FormData();
    formData.append('audio', audioFile);
    return api.post(`/sessions/${sessionId}/transcribe`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  
  embed: (sessionId: string) =>
    api.post(`/sessions/${sessionId}/embed`),
};

// Search APIs
export const searchApi = {
  searchSessions: (query: string, therapistId?: string, limit?: number) =>
    api.get('/search/sessions', { params: { q: query, therapistId, limit } }),
};

