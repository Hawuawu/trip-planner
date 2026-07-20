import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { getDb, getAdminAuth } from './firebaseAdmin';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGION = 'europe-west1';

interface InviteTripMemberRequest {
  tripId: string;
  email: string;
}

interface InviteTripMemberResult {
  status: 'invited' | 'already-member';
  uid: string;
}

export const inviteTripMember = onCall<InviteTripMemberRequest>(
  { region: REGION },
  async (request): Promise<InviteTripMemberResult> => {
    const auth = request.auth;
    if (!auth) throw new HttpsError('unauthenticated', 'Must be signed in to invite a member.');

    const tripId = request.data?.tripId;
    if (typeof tripId !== 'string' || !tripId) {
      throw new HttpsError('invalid-argument', 'tripId is required.');
    }

    const email =
      typeof request.data?.email === 'string' ? request.data.email.trim().toLowerCase() : '';
    if (!EMAIL_RE.test(email)) {
      throw new HttpsError('invalid-argument', 'A valid email address is required.');
    }

    const db = getDb();
    const tripRef = db.collection('trips').doc(tripId);
    const tripSnap = await tripRef.get();
    if (!tripSnap.exists) throw new HttpsError('not-found', 'Trip not found.');
    const trip = tripSnap.data()!;

    const canManage = !trip.ownerId || trip.ownerId === auth.uid;
    if (!canManage) {
      throw new HttpsError('permission-denied', 'Only the trip owner can invite members.');
    }

    const adminAuth = getAdminAuth();
    let invitee;
    try {
      invitee = await adminAuth.getUserByEmail(email);
    } catch (err) {
      if ((err as { code?: string }).code === 'auth/user-not-found') {
        throw new HttpsError(
          'not-found',
          "This person hasn't signed in to the app yet — ask them to sign in with Google once, then invite them again."
        );
      }
      throw new HttpsError('internal', 'Failed to look up the invited user.');
    }

    const memberIds: string[] = trip.memberIds ?? [];
    if (memberIds.includes(invitee.uid)) {
      return { status: 'already-member', uid: invitee.uid };
    }

    const actor = await adminAuth.getUser(auth.uid).catch(() => null);

    await tripRef.update({
      memberIds: FieldValue.arrayUnion(invitee.uid),
      [`memberProfiles.${invitee.uid}`]: {
        email: invitee.email ?? email,
        displayName: invitee.displayName ?? null,
      },
    });

    await tripRef.collection('activityLog').add({
      type: 'member_invited',
      actorUid: auth.uid,
      actorLabel: actor?.displayName ?? actor?.email ?? auth.uid,
      entityName: invitee.email ?? email,
      createdAt: FieldValue.serverTimestamp(),
    });

    return { status: 'invited', uid: invitee.uid };
  }
);
