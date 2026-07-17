import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged as fbOnAuthStateChanged,
} from 'firebase/auth';
import type { AuthService } from './AuthService';
import type { AuthUser } from '../types';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

function getFirebaseAuth() {
  if (!getApps().length) initializeApp(firebaseConfig);
  return getAuth();
}

function toAuthUser(u: { uid: string; email: string | null; displayName: string | null }): AuthUser {
  return { uid: u.uid, email: u.email, displayName: u.displayName };
}

export class FirebaseAuthService implements AuthService {
  private auth = getFirebaseAuth();

  getCurrentUser(): AuthUser | null {
    const u = this.auth.currentUser;
    return u ? toAuthUser(u) : null;
  }

  onAuthStateChanged(cb: (user: AuthUser | null) => void): () => void {
    return fbOnAuthStateChanged(this.auth, u => cb(u ? toAuthUser(u) : null));
  }

  async signInWithGoogle(): Promise<void> {
    await signInWithPopup(this.auth, new GoogleAuthProvider());
  }

  async signOut(): Promise<void> {
    await fbSignOut(this.auth);
  }
}
