import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { getDb, getAdminAuth } from './firebaseAdmin';
import { ADMIN_EMAIL, assertIsAdmin } from './adminConfig';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGION = 'europe-west1';

type AppActivityType = 'access_approved' | 'access_denied' | 'access_revoked';

function normalizedEmail(data: { email?: unknown } | undefined): string {
  const email = typeof data?.email === 'string' ? data.email.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email)) {
    throw new HttpsError('invalid-argument', 'A valid email address is required.');
  }
  return email;
}

function logActivity(db: Firestore, type: AppActivityType, email: string) {
  return db.collection('appActivityLog').add({
    type,
    email,
    actor: 'admin',
    createdAt: FieldValue.serverTimestamp(),
  });
}

// Stamps (or clears) the persistent appAccess claim for an existing Auth
// user. Tolerates accounts that have never signed in — their claim is
// stamped by the blocking function at first sign-in anyway.
async function setAccessClaim(email: string, appAccess: boolean): Promise<void> {
  const adminAuth = getAdminAuth();
  try {
    const user = await adminAuth.getUserByEmail(email);
    await adminAuth.setCustomUserClaims(user.uid, { appAccess });
    if (!appAccess) await adminAuth.revokeRefreshTokens(user.uid);
  } catch (err) {
    if ((err as { code?: string }).code !== 'auth/user-not-found') {
      throw new HttpsError('internal', "Failed to update the user's access claim.");
    }
  }
}

export const approveAccess = onCall<{ email: string }>(
  { region: REGION },
  async (request): Promise<void> => {
    assertIsAdmin(request);
    const email = normalizedEmail(request.data);

    const db = getDb();
    await db.collection('allowedUsers').doc(email).set({
      invitedVia: 'approved',
      createdAt: FieldValue.serverTimestamp(),
    });
    await db
      .collection('accessRequests')
      .doc(email)
      .set({ status: 'approved', decidedAt: FieldValue.serverTimestamp() }, { merge: true });

    // Persistent claim so the waiting user unlocks on a token refresh,
    // without having to sign in again.
    await setAccessClaim(email, true);
    await logActivity(db, 'access_approved', email);
  }
);

export const denyAccess = onCall<{ email: string }>(
  { region: REGION },
  async (request): Promise<void> => {
    assertIsAdmin(request);
    const email = normalizedEmail(request.data);

    const db = getDb();
    const requestRef = db.collection('accessRequests').doc(email);
    if (!(await requestRef.get()).exists) {
      throw new HttpsError('not-found', 'No access request for that email.');
    }
    await requestRef.set(
      { status: 'denied', decidedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    await logActivity(db, 'access_denied', email);
  }
);

export const revokeAppAccess = onCall<{ email: string }>(
  { region: REGION },
  async (request): Promise<void> => {
    assertIsAdmin(request);
    const email = normalizedEmail(request.data);
    if (email === ADMIN_EMAIL) {
      throw new HttpsError('failed-precondition', "The admin's own access cannot be revoked.");
    }

    const db = getDb();
    const allowedRef = db.collection('allowedUsers').doc(email);
    if (!(await allowedRef.get()).exists) {
      throw new HttpsError('not-found', 'No allowed user with that email.');
    }
    await allowedRef.delete();

    // Strip the claim and revoke refresh tokens: future sign-ins get
    // appAccess=false from the blocking function, and the current session
    // dies at its next token refresh (current ID token lives up to ~1h).
    await setAccessClaim(email, false);

    // Mark (or create) the access request as revoked so the person shows up
    // in the Requests tab for possible re-approval, without re-appearing as
    // pending on their next sign-in attempt.
    await db
      .collection('accessRequests')
      .doc(email)
      .set({ email, status: 'revoked', decidedAt: FieldValue.serverTimestamp() }, { merge: true });

    await logActivity(db, 'access_revoked', email);
  }
);
