import type { AuthUser, AllowedUser, AccessRequest, AppActivityEntry } from '../types';

export interface AuthService {
  getCurrentUser(): AuthUser | null;
  onAuthStateChanged(cb: (user: AuthUser | null) => void): () => void;
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;

  // Passwordless email "magic link" sign-in (#21). sendSignInLinkToEmail
  // emails the link and stashes the address locally so the same
  // device/browser can auto-complete on return; isSignInLink checks whether
  // a URL is a valid sign-in link; completeEmailLinkSignIn finishes the
  // flow (email is re-collected from the user if opened cross-device).
  sendSignInLinkToEmail(email: string): Promise<void>;
  isSignInLink(url: string): boolean;
  completeEmailLinkSignIn(email: string, url: string): Promise<void>;

  // Approval-based app access (#35). Sign-in always succeeds; the appAccess
  // custom claim (surfaced on AuthUser) gates everything. refreshAccess
  // force-refreshes the ID token so a just-approved user unlocks without
  // signing in again. Approve/deny/revoke are admin-only (enforced
  // server-side).
  refreshAccess(): Promise<AuthUser | null>;
  approveAccess(email: string): Promise<void>;
  denyAccess(email: string): Promise<void>;
  revokeAccess(email: string): Promise<void>;
  setAdminRole(email: string, isAdmin: boolean): Promise<void>;
  subscribeToAllowedUsers(cb: (users: AllowedUser[]) => void): () => void;
  subscribeToAccessRequests(cb: (requests: AccessRequest[]) => void): () => void;
  subscribeToAppActivity(cb: (entries: AppActivityEntry[]) => void): () => void;
}
