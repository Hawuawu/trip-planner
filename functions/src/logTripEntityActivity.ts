import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from './firebaseAdmin';
import { REGION } from './config';

// Keyed by subcollection id under trips/{tripId}. One trigger handles all 8
// mutable subcollections instead of 8 separate functions — see #102.
const TYPE_PREFIX: Record<string, string> = {
  checkpoints: 'checkpoint',
  alternatives: 'alternative',
  bookings: 'booking',
  routes: 'route',
  wikiSections: 'wiki_section',
  budgets: 'budget',
  budgetSections: 'budget_section',
  budgetItems: 'budget_item',
};

// The field each collection uses as its human-readable name in log entries.
const NAME_FIELD: Record<string, string> = {
  checkpoints: 'name',
  alternatives: 'name',
  bookings: 'provider',
  routes: 'name',
  wikiSections: 'title',
  budgets: 'name',
  budgetSections: 'name',
  budgetItems: 'name',
};

// Both change on every write regardless of what a caller actually edited —
// including them in changedFields would be pure noise.
const IGNORED_DIFF_FIELDS = new Set(['updatedAt', 'lastModifiedBy']);

interface LastModifiedBy {
  uid: string;
  label: string;
}

function diffKeys(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed: string[] = [];
  for (const key of keys) {
    if (IGNORED_DIFF_FIELDS.has(key)) continue;
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) changed.push(key);
  }
  return changed;
}

// Fires on every write under any of trips/{tripId}'s subcollections,
// including activityLog itself (the wildcard matches it too) — the first
// line below is what stops that from recursing into itself.
export const logTripEntityActivity = onDocumentWritten(
  { document: 'trips/{tripId}/{collectionId}/{docId}', region: REGION },
  async (event) => {
    const { tripId, collectionId } = event.params;
    if (collectionId === 'activityLog') return;

    const prefix = TYPE_PREFIX[collectionId];
    const nameField = NAME_FIELD[collectionId];
    if (!prefix || !nameField) return;

    const change = event.data;
    if (!change) return;

    const before = change.before.exists
      ? (change.before.data() as Record<string, unknown>)
      : undefined;
    const after = change.after.exists
      ? (change.after.data() as Record<string, unknown>)
      : undefined;

    const action = !before ? 'added' : !after ? 'deleted' : 'updated';

    // On delete there's no `after` to read lastModifiedBy from — falls back
    // to `before`, which reflects whoever last created/updated the doc, not
    // necessarily whoever deleted it. Accepted limitation (see #102):
    // Firestore delete calls carry no payload, so there's no way to
    // attribute the actual deleting user without routing deletes through an
    // Admin-SDK callable.
    const lastModifiedBy = (after ?? before)?.lastModifiedBy as LastModifiedBy | undefined;
    if (!lastModifiedBy) return;

    const entityName = (after ?? before)?.[nameField] as string | undefined;

    await getDb()
      .collection('trips')
      .doc(tripId)
      .collection('activityLog')
      .add({
        type: `${prefix}_${action}`,
        actorUid: lastModifiedBy.uid,
        actorLabel: lastModifiedBy.label,
        ...(entityName && { entityName }),
        ...(action === 'updated' && { changedFields: diffKeys(before!, after!) }),
        createdAt: FieldValue.serverTimestamp(),
      });
  }
);
