import type { AuthUser, AllowedUser, AppInvite, AppActivityEntry } from '../types';

export interface AuthService {
  getCurrentUser(): AuthUser | null;
  onAuthStateChanged(cb: (user: AuthUser | null) => void): () => void;
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;

  // App-wide invite gate (#35). Creation/cancellation/revocation are
  // admin-only (enforced server-side); redeemInvite works without a session —
  // the invitee can't sign in yet, the token is the credential.
  createInvite(): Promise<string>;
  redeemInvite(token: string, email: string): Promise<void>;
  cancelInvite(token: string): Promise<void>;
  revokeAccess(email: string): Promise<void>;
  subscribeToAllowedUsers(cb: (users: AllowedUser[]) => void): () => void;
  subscribeToInvites(cb: (invites: AppInvite[]) => void): () => void;
  subscribeToAppActivity(cb: (entries: AppActivityEntry[]) => void): () => void;
}
