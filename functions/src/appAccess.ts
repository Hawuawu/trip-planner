import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { getDb, getAdminAuth } from './firebaseAdmin';
import { assertIsAdmin } from './adminConfig';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGION = 'europe-west1';

type AppActivityType =
  'access_approved' | 'access_denied' | 'access_revoked' | 'admin_granted' | 'admin_revoked';

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

// setCustomUserClaims REPLACES the whole claims object rather than merging,
// so appAccess and admin must always be written together — otherwise e.g.
// approving someone would silently wipe an admin claim a previous grant had
// set. Tolerates accounts that have never signed in — their claims are
// stamped by the blocking function at first sign-in anyway.
async function setAccessClaims(
  email: string,
  claims: { appAccess: boolean; admin: boolean }
): Promise<void> {
  const adminAuth = getAdminAuth();
  try {
    const user = await adminAuth.getUserByEmail(email);
    await adminAuth.setCustomUserClaims(user.uid, claims);
    if (!claims.appAccess) await adminAuth.revokeRefreshTokens(user.uid);
  } catch (err) {
    if ((err as { code?: string }).code !== 'auth/user-not-found') {
      throw new HttpsError('internal', "Failed to update the user's access claims.");
    }
  }
}

async function countAdmins(db: Firestore): Promise<number> {
  const snap = await db.collection('allowedUsers').where('role', '==', 'admin').count().get();
  return snap.data().count;
}

export const approveAccess = onCall<{ email: string }>(
  { region: REGION },
  async (request): Promise<void> => {
    assertIsAdmin(request);
    const email = normalizedEmail(request.data);

    const db = getDb();
    // Always plain 'member' — admin status is a deliberate follow-up action
    // (setAdminRole), never implicit from approval, and a re-approval after a
    // revoke starts from a clean slate rather than resurrecting a prior role.
    await db.collection('allowedUsers').doc(email).set({
      invitedVia: 'approved',
      role: 'member',
      createdAt: FieldValue.serverTimestamp(),
    });
    await db
      .collection('accessRequests')
      .doc(email)
      .set({ status: 'approved', decidedAt: FieldValue.serverTimestamp() }, { merge: true });

    // Persistent claim so the waiting user unlocks on a token refresh,
    // without having to sign in again.
    await setAccessClaims(email, { appAccess: true, admin: false });
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

    const db = getDb();
    const allowedRef = db.collection('allowedUsers').doc(email);
    const allowedSnap = await allowedRef.get();
    if (!allowedSnap.exists) {
      throw new HttpsError('not-found', 'No allowed user with that email.');
    }

    // The admin set isn't a hardcoded identity anymore, so the guard is
    // general: whoever is being revoked, at least one admin must remain —
    // otherwise the app becomes permanently unmanageable.
    if (allowedSnap.data()?.role === 'admin' && (await countAdmins(db)) <= 1) {
      throw new HttpsError(
        'failed-precondition',
        'At least one admin must remain — make someone else admin first.'
      );
    }

    await allowedRef.delete();

    // Strip the claims and revoke refresh tokens: future sign-ins get
    // appAccess=false from the blocking function, and the current session
    // dies at its next token refresh (current ID token lives up to ~1h).
    await setAccessClaims(email, { appAccess: false, admin: false });

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

export const setAdminRole = onCall<{ email: string; isAdmin: boolean }>(
  { region: REGION },
  async (request): Promise<void> => {
    assertIsAdmin(request);
    const email = normalizedEmail(request.data);
    if (typeof request.data?.isAdmin !== 'boolean') {
      throw new HttpsError('invalid-argument', 'isAdmin must be a boolean.');
    }
    const isAdmin = request.data.isAdmin;

    const db = getDb();
    const allowedRef = db.collection('allowedUsers').doc(email);
    const snap = await allowedRef.get();
    if (!snap.exists) {
      throw new HttpsError(
        'failed-precondition',
        'This person must have app access before they can be made admin.'
      );
    }

    const wasAdmin = snap.data()?.role === 'admin';
    if (wasAdmin && !isAdmin && (await countAdmins(db)) <= 1) {
      throw new HttpsError('failed-precondition', 'At least one admin must remain.');
    }

    await allowedRef.update({ role: isAdmin ? 'admin' : 'member' });
    await setAccessClaims(email, { appAccess: true, admin: isAdmin });
    await logActivity(db, isAdmin ? 'admin_granted' : 'admin_revoked', email);
  }
);
