import { initializeApp } from 'firebase/app';
import {
  initializeAuth,
  GoogleAuthProvider,
  signInWithCredential,
  type Auth,
  type User,
} from 'firebase/auth';
import { firebaseConfig } from '../config.js';
import { fileAuthPersistence, hasCachedSession } from './filePersistence.js';
import { loginWithGoogle } from './deviceAuth.js';

export class AppAccessDeniedError extends Error {
  constructor() {
    super(
      "Your account isn't approved yet — ask the trip owner to approve you in the app's " +
        'App access dialog, then run this again. (Signing in worked; your account just doesn\'t ' +
        'have appAccess yet, so trip data stays inaccessible until an admin approves it.)'
    );
    this.name = 'AppAccessDeniedError';
  }
}

let authInstance: Auth | undefined;

function getSharedAuth(): Auth {
  if (!authInstance) {
    const app = initializeApp(firebaseConfig);
    authInstance = initializeAuth(app, { persistence: [fileAuthPersistence] });
  }
  return authInstance;
}

function waitForRestoredUser(auth: Auth): Promise<User | null> {
  return new Promise((resolve) => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

async function assertAppAccess(user: User): Promise<void> {
  const { claims } = await user.getIdTokenResult();
  if (claims.appAccess !== true) throw new AppAccessDeniedError();
}

// Ensures a signed-in, appAccess-approved Firebase user, returning the ready
// Auth instance every FirebaseClientTripRepository call reads from. Reuses
// the cached session (see filePersistence.ts) when one exists and is still
// valid; otherwise runs the interactive Google loopback login. Either way,
// the appAccess claim (#35's approval gate) is checked before returning —
// a merely-signed-in account isn't enough.
export async function ensureSignedIn(): Promise<Auth> {
  const auth = getSharedAuth();

  const restored = await waitForRestoredUser(auth);
  if (restored) {
    await assertAppAccess(restored);
    return auth;
  }

  if (hasCachedSession()) {
    // A credentials file existed but didn't restore a live user — most
    // likely Google revoked the refresh token. Fall through to a fresh
    // interactive login rather than erroring, same as gh/gcloud do.
    console.error('Cached session is no longer valid — signing in again.');
  }

  const { idToken } = await loginWithGoogle();
  const credential = GoogleAuthProvider.credential(idToken);
  const { user } = await signInWithCredential(auth, credential);
  await assertAppAccess(user);
  return auth;
}
