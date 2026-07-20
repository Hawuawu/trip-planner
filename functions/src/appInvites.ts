import { randomUUID } from 'node:crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { getDb, getAdminAuth } from './firebaseAdmin';
import { ADMIN_EMAIL, assertIsAdmin } from './adminConfig';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGION = 'europe-west1';

type AppActivityType = 'invite_created' | 'invite_redeemed' | 'invite_cancelled' | 'access_revoked';

function logActivity(
  db: Firestore,
  type: AppActivityType,
  fields: { email?: string; token?: string; actor: 'admin' | 'system' }
) {
  return db.collection('appActivityLog').add({
    type,
    email: fields.email ?? null,
    token: fields.token ?? null,
    actor: fields.actor,
    createdAt: FieldValue.serverTimestamp(),
  });
}

export const createAppInvite = onCall(
  { region: REGION },
  async (request): Promise<{ token: string }> => {
    assertIsAdmin(request);

    const token = randomUUID();
    const db = getDb();
    await db.collection('invites').doc(token).set({
      createdByUid: request.auth!.uid,
      createdByEmail: request.auth!.token.email,
      createdAt: FieldValue.serverTimestamp(),
      status: 'pending',
      redeemedEmail: null,
      redeemedAt: null,
    });
    await logActivity(db, 'invite_created', { token, actor: 'admin' });

    return { token };
  }
);

interface RedeemAppInviteRequest {
  token: string;
  email: string;
}

// Deliberately callable without auth: the invitee has no session yet (sign-in
// itself is gated), so possession of the invite token is the credential.
export const redeemAppInvite = onCall<RedeemAppInviteRequest>(
  { region: REGION },
  async (request): Promise<void> => {
    const token = typeof request.data?.token === 'string' ? request.data.token.trim() : '';
    if (!token) throw new HttpsError('invalid-argument', 'An invite token is required.');

    const email =
      typeof request.data?.email === 'string' ? request.data.email.trim().toLowerCase() : '';
    if (!EMAIL_RE.test(email)) {
      throw new HttpsError('invalid-argument', 'A valid email address is required.');
    }

    const db = getDb();
    await db.runTransaction(async (tx) => {
      const inviteRef = db.collection('invites').doc(token);
      const snap = await tx.get(inviteRef);
      if (!snap.exists) throw new HttpsError('not-found', 'This invite link is not valid.');

      const invite = snap.data()!;
      if (invite.status === 'redeemed') {
        if (invite.redeemedEmail === email) return; // retrying the same redemption is fine
        throw new HttpsError('failed-precondition', 'This invite link has already been used.');
      }
      if (invite.status !== 'pending') {
        throw new HttpsError('failed-precondition', 'This invite link is no longer active.');
      }

      tx.update(inviteRef, {
        status: 'redeemed',
        redeemedEmail: email,
        redeemedAt: FieldValue.serverTimestamp(),
      });
      tx.set(db.collection('allowedUsers').doc(email), {
        invitedVia: token,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.set(db.collection('appActivityLog').doc(), {
        type: 'invite_redeemed',
        email,
        token,
        actor: 'system',
        createdAt: FieldValue.serverTimestamp(),
      });
    });
  }
);

export const cancelAppInvite = onCall<{ token: string }>(
  { region: REGION },
  async (request): Promise<void> => {
    assertIsAdmin(request);

    const token = typeof request.data?.token === 'string' ? request.data.token.trim() : '';
    if (!token) throw new HttpsError('invalid-argument', 'An invite token is required.');

    const db = getDb();
    await db.runTransaction(async (tx) => {
      const inviteRef = db.collection('invites').doc(token);
      const snap = await tx.get(inviteRef);
      if (!snap.exists) throw new HttpsError('not-found', 'This invite does not exist.');
      if (snap.data()!.status !== 'pending') {
        throw new HttpsError('failed-precondition', 'Only pending invites can be cancelled.');
      }
      tx.update(inviteRef, { status: 'cancelled' });
      tx.set(db.collection('appActivityLog').doc(), {
        type: 'invite_cancelled',
        email: null,
        token,
        actor: 'admin',
        createdAt: FieldValue.serverTimestamp(),
      });
    });
  }
);

export const revokeAppAccess = onCall<{ email: string }>(
  { region: REGION },
  async (request): Promise<void> => {
    assertIsAdmin(request);

    const email =
      typeof request.data?.email === 'string' ? request.data.email.trim().toLowerCase() : '';
    if (!EMAIL_RE.test(email)) {
      throw new HttpsError('invalid-argument', 'A valid email address is required.');
    }
    if (email === ADMIN_EMAIL) {
      throw new HttpsError('failed-precondition', "The admin's own access cannot be revoked.");
    }

    const db = getDb();
    const allowedRef = db.collection('allowedUsers').doc(email);
    if (!(await allowedRef.get()).exists) {
      throw new HttpsError('not-found', 'No allowed user with that email.');
    }
    await allowedRef.delete();

    // Future sign-ins are now rejected by the blocking function, but that only
    // runs at sign-in — an existing session keeps refreshing otherwise. Revoke
    // the refresh tokens too; the current ID token still lives up to ~1h.
    const adminAuth = getAdminAuth();
    try {
      const user = await adminAuth.getUserByEmail(email);
      await adminAuth.revokeRefreshTokens(user.uid);
    } catch (err) {
      if ((err as { code?: string }).code !== 'auth/user-not-found') {
        throw new HttpsError('internal', "Failed to revoke the user's session.");
      }
      // Never signed in — nothing to revoke beyond the allowlist entry.
    }

    await logActivity(db, 'access_revoked', { email, actor: 'admin' });
  }
);
