import { beforeUserSignedIn, HttpsError } from 'firebase-functions/v2/identity';
import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from './firebaseAdmin';

const REGION = 'europe-west1';

const REJECTION_MESSAGE =
  'This app is invite-only. Ask the admin for an invite link, then try signing in again.';

// Runs on every sign-in, first-time or returning, so it covers both new
// accounts and previously-allowed accounts that have since been revoked.
// When custom-email auth is added, this must additionally require
// event.data.emailVerified for non-Google providers — otherwise anyone could
// claim an allowlisted address they don't own.
export const enforceAllowlist = beforeUserSignedIn({ region: REGION }, async (event) => {
  const email = event.data?.email?.trim().toLowerCase();
  const db = getDb();

  if (email) {
    const snap = await db.collection('allowedUsers').doc(email).get();
    if (snap.exists) return;
  }

  // Best-effort audit trail; never let a logging failure mask the rejection.
  await db
    .collection('appActivityLog')
    .add({
      type: 'sign_in_rejected',
      email: email ?? null,
      token: null,
      actor: 'system',
      createdAt: FieldValue.serverTimestamp(),
    })
    .catch(() => undefined);

  throw new HttpsError(
    'permission-denied',
    email ? REJECTION_MESSAGE : 'An email address is required to sign in.'
  );
});
