import { create } from 'zustand';
import type { AuthService } from '../data/AuthService';
import type { AuthUser } from '../types';
import { extractSignInErrorMessage } from '../utils/inviteErrors';

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  service: AuthService | null;
  authError: string | null;
  init(service: AuthService): void;
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
  clearAuthError(): void;
  createInvite(): Promise<string>;
  redeemInvite(token: string, email: string): Promise<void>;
  cancelInvite(token: string): Promise<void>;
  revokeAccess(email: string): Promise<void>;
}

function requireService(service: AuthService | null): AuthService {
  if (!service) throw new Error('Not available in local mode.');
  return service;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  service: null,
  authError: null,

  init(service) {
    set({ service });
    service.onAuthStateChanged((user) => set({ user, loading: false }));
  },

  async signInWithGoogle() {
    set({ authError: null });
    try {
      await get().service?.signInWithGoogle();
    } catch (err) {
      const message = extractSignInErrorMessage(err);
      if (message) set({ authError: message });
    }
  },

  async signOut() {
    await get().service?.signOut();
  },

  clearAuthError() {
    set({ authError: null });
  },

  async createInvite() {
    return requireService(get().service).createInvite();
  },

  async redeemInvite(token, email) {
    await requireService(get().service).redeemInvite(token, email);
  },

  async cancelInvite(token) {
    await requireService(get().service).cancelInvite(token);
  },

  async revokeAccess(email) {
    await requireService(get().service).revokeAccess(email);
  },
}));
