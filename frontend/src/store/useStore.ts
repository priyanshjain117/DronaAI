import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  user: { id: number; email: string } | null;
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark';
  setToken: (token: string | null) => void;
  setUser: (user: { id: number; email: string } | null) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  logout: () => void;
}

export const useStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      sidebarCollapsed: false,
      theme: 'dark',
      setToken: (token) => set({ token }),
      setUser: (user) => set({ user }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
      logout: () => set({ token: null, user: null }),
    }),
    {
      name: 'drona-ai-storage',
    }
  )
);
