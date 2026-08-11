import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from './firebaseAdmin';
import { REGION } from './config';

interface LastModifiedBy {
  uid: string;
  label: string;
}

const METADATA_KEYS = new Set(['name', 'dateRange']);

// Fires on every write to a trip doc, including the memberIds/memberProfiles
// updates that removeMember/leaveTrip already self-log inline (see
// src/data/firebaseTripRepository.ts) — the subset check below is what
// avoids double-logging those.
export const logTripActivity = onDocumentWritten(
  { document: 'trips/{tripId}', region: REGION },
  async (event) => {
    const { tripId } = event.params;
    const change = event.data;
    if (!change) return;

    const before = change.before.exists
      ? (change.before.data() as Record<string, unknown>)
      : undefined;
    const after = change.after.exists
      ? (change.after.data() as Record<string, unknown>)
      : undefined;

    const db = getDb();

    if (!before && after) {
      const lastModifiedBy = after.lastModifiedBy as LastModifiedBy | undefined;
      if (!lastModifiedBy) return;
      await db
        .collection('trips')
        .doc(tripId)
        .collection('activityLog')
        .add({
          type: 'trip_created',
          actorUid: lastModifiedBy.uid,
          actorLabel: lastModifiedBy.label,
          entityName: after.name as string | undefined,
          createdAt: FieldValue.serverTimestamp(),
        });
      return;
    }

    if (before && !after) {
      // The trip doc (and its activityLog subcollection) is gone by the time
      // this runs, so an entry written there would be unreadable — goes into
      // the top-level, admin-only appActivityLog instead. deleteTrip doesn't
      // cascade-delete subcollections today (a separate, pre-existing bug,
      // out of scope for #102), so this doesn't attempt to clean those up.
      await db.collection('appActivityLog').add({
        type: 'trip_deleted',
        email: null,
        actor: 'system',
        entityName: before.name as string | undefined,
        createdAt: FieldValue.serverTimestamp(),
      });
      return;
    }

    if (!before || !after) return;

    // lastModifiedBy itself changes on every write (that's the whole point
    // of stamping it) — excluded from the diff so it never trips the
    // metadata-only subset check below.
    const changedKeys = Object.keys(after).filter(
      (key) =>
        key !== 'lastModifiedBy' && JSON.stringify(before[key]) !== JSON.stringify(after[key])
    );
    if (changedKeys.length === 0) return;
    if (!changedKeys.every((key) => METADATA_KEYS.has(key))) return;

    const lastModifiedBy = after.lastModifiedBy as LastModifiedBy | undefined;
    if (!lastModifiedBy) return;

    const type = changedKeys.includes('name') ? 'trip_renamed' : 'trip_dates_updated';

    await db
      .collection('trips')
      .doc(tripId)
      .collection('activityLog')
      .add({
        type,
        actorUid: lastModifiedBy.uid,
        actorLabel: lastModifiedBy.label,
        ...(type === 'trip_renamed' && { entityName: after.name as string | undefined }),
        createdAt: FieldValue.serverTimestamp(),
      });
  }
);
