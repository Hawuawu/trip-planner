import { beforeUserSignedIn } from 'firebase-functions/v2/identity';
import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from './firebaseAdmin';

const REGION = 'europe-west1';

// Runs on every sign-in, first-time or returning. Sign-in itself always
// succeeds; access is controlled by the appAccess custom claim stamped here
// from the allowedUsers allowlist — Firestore rules require the claim for all
// trip data. A sign-in by a not-yet-approved account records an access
// request for the admin to approve (signing in IS the request).
// When custom-email auth is added, this must additionally require
// event.data.emailVerified for non-Google providers before granting the
// claim — otherwise anyone could claim an approved address they don't own.
export const stampAppAccess = beforeUserSignedIn(
  { region: REGION },
  async (event): Promise<{ customClaims: { appAccess: boolean } }> => {
    const email = event.data?.email?.trim().toLowerCase();
    if (!email) return { customClaims: { appAccess: false } };

    const db = getDb();
    const allowed = await db.collection('allowedUsers').doc(email).get();
    if (allowed.exists) return { customClaims: { appAccess: true } };

    // Not approved: record (or refresh) the pending access request. Denied
    // requests stay denied — repeat sign-ins only bump lastSeenAt.
    const requestRef = db.collection('accessRequests').doc(email);
    const existing = await requestRef.get();
    if (existing.exists) {
      await requestRef.update({ lastSeenAt: FieldValue.serverTimestamp() }).catch(() => undefined);
    } else {
      await requestRef
        .set({
          email,
          displayName: event.data?.displayName ?? null,
          status: 'pending',
          firstSeenAt: FieldValue.serverTimestamp(),
          lastSeenAt: FieldValue.serverTimestamp(),
        })
        .catch(() => undefined);
      await db
        .collection('appActivityLog')
        .add({
          type: 'access_requested',
          email,
          actor: 'system',
          createdAt: FieldValue.serverTimestamp(),
        })
        .catch(() => undefined);
    }

    return { customClaims: { appAccess: false } };
  }
);
