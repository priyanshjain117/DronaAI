import axios from 'axios';
import { useStore } from '../store/useStore';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = useStore.getState().token;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url = String(error?.config?.url || '');
    const isAuthRequest = url.includes('/auth/login') || url.includes('/auth/signup');

    if (status === 401 && !isAuthRequest) {
      useStore.getState().logout();

      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        const next = `${window.location.pathname}${window.location.search}`;
        window.location.href = `/login?next=${encodeURIComponent(next)}`;
      }
    }

    return Promise.reject(error);
  }
);
