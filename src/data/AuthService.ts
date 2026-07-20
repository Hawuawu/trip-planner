import type { AuthUser, AllowedUser, AccessRequest, AppActivityEntry } from '../types';

export interface AuthService {
  getCurrentUser(): AuthUser | null;
  onAuthStateChanged(cb: (user: AuthUser | null) => void): () => void;
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;

  // Approval-based app access (#35). Sign-in always succeeds; the appAccess
  // custom claim (surfaced on AuthUser) gates everything. refreshAccess
  // force-refreshes the ID token so a just-approved user unlocks without
  // signing in again. Approve/deny/revoke are admin-only (enforced
  // server-side).
  refreshAccess(): Promise<AuthUser | null>;
  approveAccess(email: string): Promise<void>;
  denyAccess(email: string): Promise<void>;
  revokeAccess(email: string): Promise<void>;
  subscribeToAllowedUsers(cb: (users: AllowedUser[]) => void): () => void;
  subscribeToAccessRequests(cb: (requests: AccessRequest[]) => void): () => void;
  subscribeToAppActivity(cb: (entries: AppActivityEntry[]) => void): () => void;
}
