import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged as fbOnAuthStateChanged,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import type { AuthService } from './AuthService';
import type { AuthUser, AllowedUser, AccessRequest, AppActivityEntry } from '../types';

const FUNCTIONS_REGION = 'europe-west1';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

function ensureApp() {
  if (!getApps().length) initializeApp(firebaseConfig);
  return getApps()[0];
}

function toAuthUser(u: {
  uid: string;
  email: string | null;
  displayName: string | null;
}): AuthUser {
  return { uid: u.uid, email: u.email, displayName: u.displayName };
}

// Reads the appAccess custom claim (stamped by the stampAppAccess blocking
// function at sign-in) off the ID token. forceRefresh mints a fresh token so
// a claim the admin just granted is picked up without re-signing-in.
async function toAuthUserWithClaims(u: User, forceRefresh = false): Promise<AuthUser> {
  const { claims } = await u.getIdTokenResult(forceRefresh);
  return { ...toAuthUser(u), appAccess: claims.appAccess === true };
}

function toIso(val: unknown): string {
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

export class FirebaseAuthService implements AuthService {
  private auth = getAuth(ensureApp());
  private functions = getFunctions(ensureApp(), FUNCTIONS_REGION);

  getCurrentUser(): AuthUser | null {
    const u = this.auth.currentUser;
    return u ? toAuthUser(u) : null;
  }

  onAuthStateChanged(cb: (user: AuthUser | null) => void): () => void {
    return fbOnAuthStateChanged(this.auth, (u) => {
      if (!u) {
        cb(null);
        return;
      }
      void toAuthUserWithClaims(u).then(cb);
    });
  }

  async signInWithGoogle(): Promise<void> {
    await signInWithPopup(this.auth, new GoogleAuthProvider());
  }

  async signOut(): Promise<void> {
    await fbSignOut(this.auth);
  }

  async refreshAccess(): Promise<AuthUser | null> {
    const u = this.auth.currentUser;
    return u ? toAuthUserWithClaims(u, true) : null;
  }

  async approveAccess(email: string): Promise<void> {
    const callable = httpsCallable<{ email: string }, void>(this.functions, 'approveAccess');
    await callable({ email });
  }

  async denyAccess(email: string): Promise<void> {
    const callable = httpsCallable<{ email: string }, void>(this.functions, 'denyAccess');
    await callable({ email });
  }

  async revokeAccess(email: string): Promise<void> {
    const callable = httpsCallable<{ email: string }, void>(this.functions, 'revokeAppAccess');
    await callable({ email });
  }

  subscribeToAllowedUsers(cb: (users: AllowedUser[]) => void): () => void {
    const q = query(collection(getFirestore(), 'allowedUsers'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => {
      cb(
        snap.docs.map((d) => ({
          email: d.id,
          invitedVia: typeof d.data().invitedVia === 'string' ? d.data().invitedVia : 'seed',
          createdAt: toIso(d.data().createdAt),
        }))
      );
    });
  }

  subscribeToAccessRequests(cb: (requests: AccessRequest[]) => void): () => void {
    const q = query(collection(getFirestore(), 'accessRequests'), orderBy('lastSeenAt', 'desc'));
    return onSnapshot(q, (snap) => {
      cb(
        snap.docs.map((d) => ({
          email: d.id,
          displayName: d.data().displayName ?? null,
          status: d.data().status ?? 'pending',
          firstSeenAt: toIso(d.data().firstSeenAt),
          lastSeenAt: toIso(d.data().lastSeenAt),
        }))
      );
    });
  }

  subscribeToAppActivity(cb: (entries: AppActivityEntry[]) => void): () => void {
    const q = query(collection(getFirestore(), 'appActivityLog'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => {
      cb(
        snap.docs.map((d) => ({
          id: d.id,
          type: d.data().type,
          email: d.data().email ?? null,
          actor: d.data().actor ?? 'system',
          createdAt: toIso(d.data().createdAt),
        }))
      );
    });
  }
}
