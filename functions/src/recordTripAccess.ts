import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { getDb, getAdminAuth } from './firebaseAdmin';

const REGION = 'europe-west1';

interface RecordTripAccessRequest {
  tripId: string;
}

interface RecordTripAccessResult {
  status: 'joined' | 'already-recorded';
}

export const recordTripAccess = onCall<RecordTripAccessRequest>(
  { region: REGION },
  async (request): Promise<RecordTripAccessResult> => {
    const auth = request.auth;
    if (!auth) throw new HttpsError('unauthenticated', 'Must be signed in.');

    const tripId = request.data?.tripId;
    if (typeof tripId !== 'string' || !tripId) {
      throw new HttpsError('invalid-argument', 'tripId is required.');
    }

    const db = getDb();
    const tripRef = db.collection('trips').doc(tripId);
    const adminAuth = getAdminAuth();

    return db.runTransaction(async (tx): Promise<RecordTripAccessResult> => {
      const snap = await tx.get(tripRef);
      if (!snap.exists) throw new HttpsError('not-found', 'Trip not found.');
      const trip = snap.data()!;

      const memberIds: string[] = trip.memberIds ?? [];
      if (!memberIds.includes(auth.uid)) {
        throw new HttpsError('permission-denied', 'Not a member of this trip.');
      }

      const existingProfile = trip.memberProfiles?.[auth.uid];
      if (existingProfile?.joinedAt) {
        return { status: 'already-recorded' };
      }

      const actor = await adminAuth.getUser(auth.uid).catch(() => null);

      tx.set(
        tripRef,
        {
          memberProfiles: {
            [auth.uid]: {
              email: actor?.email ?? existingProfile?.email ?? null,
              displayName: actor?.displayName ?? existingProfile?.displayName ?? null,
              joinedAt: FieldValue.serverTimestamp(),
            },
          },
        },
        { merge: true }
      );

      const logRef = tripRef.collection('activityLog').doc();
      tx.set(logRef, {
        type: 'member_joined',
        actorUid: auth.uid,
        actorLabel: actor?.displayName ?? actor?.email ?? auth.uid,
        createdAt: FieldValue.serverTimestamp(),
      });

      return { status: 'joined' };
    });
  }
);
