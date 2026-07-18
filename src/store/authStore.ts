import { create } from 'zustand';
import type { AuthService } from '../data/AuthService';
import type { AuthUser } from '../types';

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  service: AuthService | null;
  init(service: AuthService): void;
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  service: null,

  init(service) {
    set({ service });
    service.onAuthStateChanged(user => set({ user, loading: false }));
  },

  async signInWithGoogle() {
    await get().service?.signInWithGoogle();
  },

  async signOut() {
    await get().service?.signOut();
  },
}));
