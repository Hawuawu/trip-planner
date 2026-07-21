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
  refreshAccess(): Promise<void>;
  approveAccess(email: string): Promise<void>;
  denyAccess(email: string): Promise<void>;
  revokeAccess(email: string): Promise<void>;
  setAdminRole(email: string, isAdmin: boolean): Promise<void>;
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

  // Force-refreshes the ID token so a just-granted appAccess claim takes
  // effect without a second sign-in ("Check again" on the waiting screen).
  async refreshAccess() {
    const user = await requireService(get().service).refreshAccess();
    if (user) set({ user });
  },

  async approveAccess(email) {
    await requireService(get().service).approveAccess(email);
  },

  async denyAccess(email) {
    await requireService(get().service).denyAccess(email);
  },

  async revokeAccess(email) {
    await requireService(get().service).revokeAccess(email);
  },

  async setAdminRole(email, isAdmin) {
    await requireService(get().service).setAdminRole(email, isAdmin);
  },
}));
