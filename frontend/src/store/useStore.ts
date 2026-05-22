import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  user: { id: number; email: string } | null;
  sidebarCollapsed: boolean;
  setToken: (token: string | null) => void;
  setUser: (user: { id: number; email: string } | null) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  logout: () => void;
}

export const useStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      sidebarCollapsed: false,
      setToken: (token) => set({ token }),
      setUser: (user) => set({ user }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      logout: () => set({ token: null, user: null }),
    }),
    {
      name: 'drona-ai-storage',
    }
  )
);
