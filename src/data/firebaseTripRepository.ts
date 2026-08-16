import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  initializeFirestore,
  doc,
  getDoc,
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  documentId,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  arrayRemove,
  deleteField,
  serverTimestamp,
  Timestamp,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';

import { ACTIVITY_LOG_PAGE_SIZE, ACTIVITY_LOG_LIVE_WINDOW } from './activityLogConfig';
import type { TripRepository } from './TripRepository';
import type {
  Trip,
  Checkpoint,
  Alternative,
  Booking,
  Route,
  WikiSection,
  Budget,
  BudgetSection,
  BudgetItem,
  MemberProfile,
  ActivityLogEntry,
  ActivityLogEntryType,
  InviteMemberResult,
} from '../types';

// Stamped into every mutable-subcollection write and onto trip metadata
// writes. The logTripEntityActivity/logTripActivity Cloud Function triggers
// (functions/src/) read this to attribute activity log entries server-side —
// see #102. Not part of any public entity type; it's a write-only field
// firestore.rules also checks against request.auth.uid to prevent spoofing.
interface LastModifiedBy {
  uid: string;
  label: string;
}

// Must match REGION in functions/src/config.ts and firebase.json's Firestore
// `location` (chosen for latency, not arbitrary).
const FUNCTIONS_REGION = 'europe-west1';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

function ensureApp() {
  if (!getApps().length) initializeApp(firebaseConfig);
  return getApps()[0];
}

let dbInstance: Firestore | undefined;

// Every add/update method below spreads a caller-supplied object (e.g. a
// Checkpoint's optional `endTime`/`location`/`notes`/`websiteUrl`/`tags`)
// straight into addDoc/updateDoc. Those fields are routinely `undefined`
// when empty, and Firestore's default Firestore instance throws
// "Unsupported field value: undefined" for that rather than just omitting
// the key — ignoreUndefinedProperties makes it omit instead, matching how
// LocalTripRepository's plain-object/JSON.stringify storage already
// behaves. Memoized because initializeFirestore can only be called once
// per app; getDb() must be the first thing to touch Firestore on this app
// (see firebaseAuthService.ts, which imports and reuses this same
// instance rather than calling getFirestore() itself).
export function getDb(): Firestore {
  const app = ensureApp();
  if (!dbInstance) {
    dbInstance = initializeFirestore(app, { ignoreUndefinedProperties: true });
  }
  return dbInstance;
}

function toIso(val: unknown): string {
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

function toMemberProfiles(raw: unknown): Record<string, MemberProfile> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  return Object.fromEntries(
    Object.entries(
      raw as Record<
        string,
        { email?: string | null; displayName?: string | null; joinedAt?: unknown }
      >
    ).map(([uid, p]) => [
      uid,
      {
        email: p.email ?? null,
        displayName: p.displayName ?? null,
        ...(p.joinedAt !== undefined && { joinedAt: toIso(p.joinedAt) }),
      },
    ])
  );
}

export class FirebaseTripRepository implements TripRepository {
  private db = getDb();
  private functions = getFunctions(ensureApp(), FUNCTIONS_REGION);

  private toTrip(id: string, d: Record<string, unknown>): Trip {
    return {
      id,
      name: d.name as string,
      dateRange: d.dateRange as Trip['dateRange'],
      memberIds: (d.memberIds as string[]) ?? [],
      ownerId: d.ownerId as string | undefined,
      memberProfiles: toMemberProfiles(d.memberProfiles),
    };
  }

  // Every add/update method below spreads this into its write payload so the
  // logTripEntityActivity/logTripActivity Cloud Function triggers can
  // attribute the resulting activity log entry to a real actor — see #102.
  // Throws rather than silently omitting the stamp: an unauthenticated write
  // would already be rejected by firestore.rules (isMember requires
  // request.auth != null), so reaching this with no user means something is
  // wrong with the caller, not a case to degrade gracefully from.
  private stampWriter(): LastModifiedBy {
    const user = getAuth().currentUser;
    if (!user) throw new Error('Must be signed in');
    return { uid: user.uid, label: user.displayName ?? user.email ?? user.uid };
  }

  async getTrip(tripId: string): Promise<Trip> {
    const snap = await getDoc(doc(this.db, 'trips', tripId));
    if (!snap.exists()) throw new Error(`Trip ${tripId} not found`);
    return this.toTrip(snap.id, snap.data());
  }

  subscribeToTrip(tripId: string, cb: (trip: Trip) => void): () => void {
    return onSnapshot(doc(this.db, 'trips', tripId), (snap) => {
      if (!snap.exists()) return;
      const trip = this.toTrip(snap.id, snap.data());
      cb(trip);
      void this.selfHealMemberProfile(tripId, trip);
    });
  }

  // Backfills the current user's own memberProfiles entry when missing —
  // covers trips created before memberProfiles existed, and members who
  // haven't opened the trip since being added. Silent/best-effort: the UI
  // already rendered with the uid fallback, so this just quietly fills in
  // the real label once the next snapshot arrives.
  private async selfHealMemberProfile(tripId: string, trip: Trip): Promise<void> {
    const user = getAuth().currentUser;
    if (!user) return;
    if (!trip.memberIds.includes(user.uid)) return;
    if (trip.memberProfiles?.[user.uid]) return;
    try {
      await updateDoc(doc(this.db, 'trips', tripId), {
        [`memberProfiles.${user.uid}`]: { email: user.email, displayName: user.displayName },
      });
    } catch {
      // best-effort — a stale uid label is a cosmetic issue, not worth surfacing
    }
  }

  async listTrips(): Promise<Trip[]> {
    const uid = getAuth().currentUser?.uid;
    if (!uid) return [];
    const snap = await getDocs(
      query(collection(this.db, 'trips'), where('memberIds', 'array-contains', uid))
    );
    return snap.docs.map((d) => this.toTrip(d.id, d.data()));
  }

  async createTrip(name: string, dateRange: { start: string; end: string }): Promise<Trip> {
    const user = getAuth().currentUser;
    if (!user) throw new Error('Must be signed in to create a trip');
    const memberIds = [user.uid];
    const memberProfiles: Record<string, MemberProfile> = {
      [user.uid]: { email: user.email, displayName: user.displayName },
    };
    const ref = await addDoc(collection(this.db, 'trips'), {
      name,
      dateRange,
      memberIds,
      ownerId: user.uid,
      memberProfiles,
      lastModifiedBy: { uid: user.uid, label: user.displayName ?? user.email ?? user.uid },
    });
    return { id: ref.id, name, dateRange, memberIds, ownerId: user.uid, memberProfiles };
  }

  async updateTrip(
    tripId: string,
    changes: Partial<Pick<Trip, 'name' | 'dateRange'>>
  ): Promise<void> {
    await updateDoc(doc(this.db, 'trips', tripId), {
      ...changes,
      lastModifiedBy: this.stampWriter(),
    });
  }

  async deleteTrip(tripId: string): Promise<void> {
    await deleteDoc(doc(this.db, 'trips', tripId));
  }

  async inviteMember(tripId: string, email: string): Promise<InviteMemberResult> {
    const callable = httpsCallable<{ tripId: string; email: string }, InviteMemberResult>(
      this.functions,
      'inviteTripMember'
    );
    const result = await callable({ tripId, email });
    return result.data;
  }

  async removeMember(tripId: string, uid: string): Promise<void> {
    const tripRef = doc(this.db, 'trips', tripId);
    const snap = await getDoc(tripRef);
    if (!snap.exists()) throw new Error(`Trip ${tripId} not found`);
    const profile = (snap.data().memberProfiles as Record<string, MemberProfile> | undefined)?.[
      uid
    ];
    const label = profile?.displayName ?? profile?.email ?? uid;

    // No lastModifiedBy stamp here: firestore.rules' membership-shrink branch
    // is `affectedKeys().hasOnly(['memberIds', 'memberProfiles'])` — adding a
    // third key would make every removeMember call fail that check. Harmless
    // to omit: logTripActivity only reacts to name/dateRange diffs anyway, so
    // a memberIds-only write is never attributed through this field.
    const batch = writeBatch(this.db);
    batch.update(tripRef, {
      memberIds: arrayRemove(uid),
      [`memberProfiles.${uid}`]: deleteField(),
    });
    const actor = getAuth().currentUser;
    if (actor) {
      batch.set(doc(collection(this.db, 'trips', tripId, 'activityLog')), {
        type: 'member_removed' as ActivityLogEntryType,
        actorUid: actor.uid,
        actorLabel: actor.displayName ?? actor.email ?? actor.uid,
        entityName: label,
        createdAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }

  async leaveTrip(tripId: string): Promise<void> {
    const user = getAuth().currentUser;
    if (!user) throw new Error('Must be signed in to leave a trip');
    const tripRef = doc(this.db, 'trips', tripId);
    const batch = writeBatch(this.db);
    batch.update(tripRef, {
      memberIds: arrayRemove(user.uid),
      [`memberProfiles.${user.uid}`]: deleteField(),
    });
    batch.set(doc(collection(this.db, 'trips', tripId, 'activityLog')), {
      type: 'member_left' as ActivityLogEntryType,
      actorUid: user.uid,
      actorLabel: user.displayName ?? user.email ?? user.uid,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  }

  async recordAccess(tripId: string): Promise<void> {
    const callable = httpsCallable<{ tripId: string }, { status: string }>(
      this.functions,
      'recordTripAccess'
    );
    await callable({ tripId });
  }

  subscribeToActivityLog(tripId: string, cb: (entries: ActivityLogEntry[]) => void): () => void {
    const q = query(
      collection(this.db, 'trips', tripId, 'activityLog'),
      orderBy('createdAt', 'desc'),
      limit(ACTIVITY_LOG_LIVE_WINDOW)
    );
    return onSnapshot(q, (snap) => {
      cb(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            type: data.type,
            actorUid: data.actorUid,
            actorLabel: data.actorLabel,
            entityName: data.entityName ?? undefined,
            changedFields: data.changedFields ?? undefined,
            createdAt: toIso(data.createdAt),
          };
        })
      );
    });
  }

  async getActivityLogBefore(
    tripId: string,
    cursor: { createdAt: string; id: string }
  ): Promise<{ entries: ActivityLogEntry[]; hasMore: boolean }> {
    const q = query(
      collection(this.db, 'trips', tripId, 'activityLog'),
      orderBy('createdAt', 'desc'),
      orderBy(documentId(), 'desc'),
      startAfter(Timestamp.fromDate(new Date(cursor.createdAt)), cursor.id),
      limit(ACTIVITY_LOG_PAGE_SIZE + 1)
    );
    const snap = await getDocs(q);
    const docs = snap.docs.slice(0, ACTIVITY_LOG_PAGE_SIZE);
    const entries = docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        type: data.type,
        actorUid: data.actorUid,
        actorLabel: data.actorLabel,
        entityName: data.entityName ?? undefined,
        changedFields: data.changedFields ?? undefined,
        count: data.count ?? undefined,
        createdAt: toIso(data.createdAt),
      };
    });
    return { entries, hasMore: snap.docs.length > ACTIVITY_LOG_PAGE_SIZE };
  }

  subscribeToCheckpoints(tripId: string, cb: (checkpoints: Checkpoint[]) => void): () => void {
    return onSnapshot(collection(this.db, 'trips', tripId, 'checkpoints'), (snap) => {
      const checkpoints: Checkpoint[] = snap.docs.map((d) => ({
        id: d.id,
        type: d.data().type,
        name: d.data().name,
        startTime: toIso(d.data().startTime),
        endTime: d.data().endTime ? toIso(d.data().endTime) : undefined,
        location: d.data().location ?? undefined,
        notes: d.data().notes ?? undefined,
        websiteUrl: d.data().websiteUrl ?? undefined,
        tags: d.data().tags ?? undefined,
        linkedBookingId: d.data().linkedBookingId ?? undefined,
        updatedAt: toIso(d.data().updatedAt),
      }));
      checkpoints.sort((a, b) => a.startTime.localeCompare(b.startTime));
      cb(checkpoints);
    });
  }

  async addCheckpoint(
    tripId: string,
    cp: Omit<Checkpoint, 'id' | 'updatedAt'>
  ): Promise<Checkpoint> {
    const now = new Date().toISOString();
    const ref = await addDoc(collection(this.db, 'trips', tripId, 'checkpoints'), {
      ...cp,
      updatedAt: serverTimestamp(),
      lastModifiedBy: this.stampWriter(),
    });
    return { ...cp, id: ref.id, updatedAt: now };
  }

  async updateCheckpoint(
    tripId: string,
    id: string,
    changes: Partial<Omit<Checkpoint, 'id' | 'updatedAt'>>
  ): Promise<void> {
    await updateDoc(doc(this.db, 'trips', tripId, 'checkpoints', id), {
      ...changes,
      updatedAt: serverTimestamp(),
      lastModifiedBy: this.stampWriter(),
    });
  }

  async addCheckpoints(
    tripId: string,
    checkpoints: Omit<Checkpoint, 'id' | 'updatedAt'>[]
  ): Promise<Checkpoint[]> {
    const now = new Date().toISOString();
    const lastModifiedBy = this.stampWriter();
    const batch = writeBatch(this.db);
    const collectionRef = collection(this.db, 'trips', tripId, 'checkpoints');
    const refs = checkpoints.map(() => doc(collectionRef));
    checkpoints.forEach((cp, i) => {
      batch.set(refs[i], { ...cp, updatedAt: serverTimestamp(), lastModifiedBy });
    });
    await batch.commit();
    return checkpoints.map((cp, i) => ({ ...cp, id: refs[i].id, updatedAt: now }));
  }

  async deleteCheckpoint(tripId: string, id: string): Promise<void> {
    await deleteDoc(doc(this.db, 'trips', tripId, 'checkpoints', id));
  }

  subscribeToAlternatives(tripId: string, cb: (alternatives: Alternative[]) => void): () => void {
    return onSnapshot(collection(this.db, 'trips', tripId, 'alternatives'), (snap) => {
      cb(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ...(data as Omit<Alternative, 'id' | 'createdAt'>),
            createdAt: data.createdAt ? toIso(data.createdAt) : undefined,
          };
        })
      );
    });
  }

  async addAlternative(
    tripId: string,
    alt: Omit<Alternative, 'id' | 'createdAt'>
  ): Promise<Alternative> {
    const now = new Date().toISOString();
    const ref = await addDoc(collection(this.db, 'trips', tripId, 'alternatives'), {
      ...alt,
      createdAt: serverTimestamp(),
      lastModifiedBy: this.stampWriter(),
    });
    return { ...alt, id: ref.id, createdAt: now };
  }

  async addAlternatives(
    tripId: string,
    alternatives: Omit<Alternative, 'id' | 'createdAt'>[]
  ): Promise<Alternative[]> {
    const now = new Date().toISOString();
    const lastModifiedBy = this.stampWriter();
    const batch = writeBatch(this.db);
    const collectionRef = collection(this.db, 'trips', tripId, 'alternatives');
    const refs = alternatives.map(() => doc(collectionRef));
    alternatives.forEach((alt, i) => {
      batch.set(refs[i], { ...alt, createdAt: serverTimestamp(), lastModifiedBy });
    });
    await batch.commit();
    return alternatives.map((alt, i) => ({ ...alt, id: refs[i].id, createdAt: now }));
  }

  async updateAlternative(
    tripId: string,
    id: string,
    changes: Partial<Omit<Alternative, 'id' | 'createdAt'>>
  ): Promise<void> {
    await updateDoc(doc(this.db, 'trips', tripId, 'alternatives', id), {
      ...changes,
      lastModifiedBy: this.stampWriter(),
    });
  }

  async deleteAlternative(tripId: string, id: string): Promise<void> {
    await deleteDoc(doc(this.db, 'trips', tripId, 'alternatives', id));
  }

  async promoteAlternative(
    tripId: string,
    alternativeId: string,
    startTime: string
  ): Promise<void> {
    const altRef = doc(this.db, 'trips', tripId, 'alternatives', alternativeId);
    const altSnap = await getDoc(altRef);
    if (!altSnap.exists()) throw new Error('Alternative not found');
    const alt = altSnap.data();
    await addDoc(collection(this.db, 'trips', tripId, 'checkpoints'), {
      type: alt.type,
      name: alt.name,
      startTime,
      ...(alt.location && { location: alt.location }),
      ...(alt.notes && { notes: alt.notes }),
      ...(alt.websiteUrl && { websiteUrl: alt.websiteUrl }),
      ...(alt.tags && alt.tags.length > 0 && { tags: alt.tags }),
      updatedAt: serverTimestamp(),
      lastModifiedBy: this.stampWriter(),
    });
    await deleteDoc(altRef);
  }

  subscribeToBookings(tripId: string, cb: (bookings: Booking[]) => void): () => void {
    return onSnapshot(collection(this.db, 'trips', tripId, 'bookings'), (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Booking));
    });
  }

  async addBooking(tripId: string, booking: Omit<Booking, 'id'>): Promise<Booking> {
    const ref = await addDoc(collection(this.db, 'trips', tripId, 'bookings'), {
      ...booking,
      lastModifiedBy: this.stampWriter(),
    });
    return { ...booking, id: ref.id };
  }

  async updateBooking(
    tripId: string,
    id: string,
    changes: Partial<Omit<Booking, 'id'>>
  ): Promise<void> {
    await updateDoc(doc(this.db, 'trips', tripId, 'bookings', id), {
      ...changes,
      lastModifiedBy: this.stampWriter(),
    });
  }

  // Deleting bookings through the app isn't supported yet (#22's refresh
  // scoped delete out entirely, and the UI-side delete button predates that
  // decision) — tracked separately, not implemented here.
  async deleteBooking(_tripId: string, _id: string): Promise<void> {
    throw new Error('Not implemented');
  }

  subscribeToRoutes(tripId: string, cb: (routes: Route[]) => void): () => void {
    return onSnapshot(collection(this.db, 'trips', tripId, 'routes'), (snap) => {
      cb(
        snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name,
          days: d.data().days ?? [],
          checkpointIds: d.data().checkpointIds ?? [],
          updatedAt: toIso(d.data().updatedAt),
        }))
      );
    });
  }

  async addRoute(tripId: string, route: Omit<Route, 'id' | 'updatedAt'>): Promise<Route> {
    const now = new Date().toISOString();
    const ref = await addDoc(collection(this.db, 'trips', tripId, 'routes'), {
      ...route,
      updatedAt: serverTimestamp(),
      lastModifiedBy: this.stampWriter(),
    });
    return { ...route, id: ref.id, updatedAt: now };
  }

  async updateRoute(
    tripId: string,
    id: string,
    changes: Partial<Omit<Route, 'id' | 'updatedAt'>>
  ): Promise<void> {
    await updateDoc(doc(this.db, 'trips', tripId, 'routes', id), {
      ...changes,
      updatedAt: serverTimestamp(),
      lastModifiedBy: this.stampWriter(),
    });
  }

  async deleteRoute(tripId: string, id: string): Promise<void> {
    await deleteDoc(doc(this.db, 'trips', tripId, 'routes', id));
  }

  subscribeToWikiSections(tripId: string, cb: (sections: WikiSection[]) => void): () => void {
    return onSnapshot(collection(this.db, 'trips', tripId, 'wikiSections'), (snap) => {
      cb(
        snap.docs.map((d) => ({
          id: d.id,
          title: d.data().title,
          content: d.data().content ?? '',
          order: d.data().order ?? 0,
          updatedAt: toIso(d.data().updatedAt),
        }))
      );
    });
  }

  async addWikiSection(
    tripId: string,
    section: Omit<WikiSection, 'id' | 'updatedAt'>
  ): Promise<WikiSection> {
    const now = new Date().toISOString();
    const ref = await addDoc(collection(this.db, 'trips', tripId, 'wikiSections'), {
      ...section,
      updatedAt: serverTimestamp(),
      lastModifiedBy: this.stampWriter(),
    });
    return { ...section, id: ref.id, updatedAt: now };
  }

  async updateWikiSection(
    tripId: string,
    id: string,
    changes: Partial<Omit<WikiSection, 'id' | 'updatedAt'>>
  ): Promise<void> {
    await updateDoc(doc(this.db, 'trips', tripId, 'wikiSections', id), {
      ...changes,
      updatedAt: serverTimestamp(),
      lastModifiedBy: this.stampWriter(),
    });
  }

  async deleteWikiSection(tripId: string, id: string): Promise<void> {
    await deleteDoc(doc(this.db, 'trips', tripId, 'wikiSections', id));
  }

  subscribeToBudgets(tripId: string, cb: (budgets: Budget[]) => void): () => void {
    return onSnapshot(collection(this.db, 'trips', tripId, 'budgets'), (snap) => {
      cb(
        snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name,
          currency: d.data().currency,
          updatedAt: toIso(d.data().updatedAt),
        }))
      );
    });
  }

  async addBudget(tripId: string, budget: Omit<Budget, 'id' | 'updatedAt'>): Promise<Budget> {
    const now = new Date().toISOString();
    const ref = await addDoc(collection(this.db, 'trips', tripId, 'budgets'), {
      ...budget,
      updatedAt: serverTimestamp(),
      lastModifiedBy: this.stampWriter(),
    });
    return { ...budget, id: ref.id, updatedAt: now };
  }

  async updateBudget(
    tripId: string,
    id: string,
    changes: Partial<Omit<Budget, 'id' | 'updatedAt'>>
  ): Promise<void> {
    await updateDoc(doc(this.db, 'trips', tripId, 'budgets', id), {
      ...changes,
      updatedAt: serverTimestamp(),
      lastModifiedBy: this.stampWriter(),
    });
  }

  // Cascade-deletes child budgetSections/budgetItems in the same batch as
  // the budget itself. Each deleted doc produces its own
  // budget_deleted/budget_section_deleted/budget_item_deleted entry via
  // logTripEntityActivity (per-item, not a collapsed summary — see #102).
  async deleteBudget(tripId: string, id: string): Promise<void> {
    const ref = doc(this.db, 'trips', tripId, 'budgets', id);

    const sectionsSnap = await getDocs(
      query(collection(this.db, 'trips', tripId, 'budgetSections'), where('budgetId', '==', id))
    );
    const sectionIds = sectionsSnap.docs.map((d) => d.id);
    const itemsSnaps = await Promise.all(
      sectionIds.map((sectionId) =>
        getDocs(
          query(
            collection(this.db, 'trips', tripId, 'budgetItems'),
            where('budgetSectionId', '==', sectionId)
          )
        )
      )
    );

    const batch = writeBatch(this.db);
    itemsSnaps.forEach((itemsSnap) => itemsSnap.docs.forEach((d) => batch.delete(d.ref)));
    sectionsSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(ref);
    await batch.commit();
  }

  subscribeToBudgetSections(tripId: string, cb: (sections: BudgetSection[]) => void): () => void {
    return onSnapshot(collection(this.db, 'trips', tripId, 'budgetSections'), (snap) => {
      cb(
        snap.docs.map((d) => ({
          id: d.id,
          budgetId: d.data().budgetId,
          category: d.data().category,
          name: d.data().name,
          price: d.data().price ?? undefined,
          notes: d.data().notes ?? undefined,
          order: d.data().order ?? 0,
          updatedAt: toIso(d.data().updatedAt),
        }))
      );
    });
  }

  async addBudgetSection(
    tripId: string,
    section: Omit<BudgetSection, 'id' | 'updatedAt'>
  ): Promise<BudgetSection> {
    const now = new Date().toISOString();
    const ref = await addDoc(collection(this.db, 'trips', tripId, 'budgetSections'), {
      ...section,
      updatedAt: serverTimestamp(),
      lastModifiedBy: this.stampWriter(),
    });
    return { ...section, id: ref.id, updatedAt: now };
  }

  async updateBudgetSection(
    tripId: string,
    id: string,
    changes: Partial<Omit<BudgetSection, 'id' | 'updatedAt'>>
  ): Promise<void> {
    await updateDoc(doc(this.db, 'trips', tripId, 'budgetSections', id), {
      ...changes,
      updatedAt: serverTimestamp(),
      lastModifiedBy: this.stampWriter(),
    });
  }

  async deleteBudgetSection(tripId: string, id: string): Promise<void> {
    const ref = doc(this.db, 'trips', tripId, 'budgetSections', id);

    const itemsSnap = await getDocs(
      query(collection(this.db, 'trips', tripId, 'budgetItems'), where('budgetSectionId', '==', id))
    );

    const batch = writeBatch(this.db);
    itemsSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(ref);
    await batch.commit();
  }

  subscribeToBudgetItems(tripId: string, cb: (items: BudgetItem[]) => void): () => void {
    return onSnapshot(collection(this.db, 'trips', tripId, 'budgetItems'), (snap) => {
      cb(
        snap.docs.map((d) => ({
          id: d.id,
          budgetSectionId: d.data().budgetSectionId,
          name: d.data().name,
          price: d.data().price ?? undefined,
          rateType: d.data().rateType,
          quantity: d.data().quantity ?? 1,
          alternatives: d.data().alternatives ?? undefined,
          notes: d.data().notes ?? undefined,
          order: d.data().order ?? 0,
          updatedAt: toIso(d.data().updatedAt),
        }))
      );
    });
  }

  async addBudgetItem(
    tripId: string,
    item: Omit<BudgetItem, 'id' | 'updatedAt'>
  ): Promise<BudgetItem> {
    const now = new Date().toISOString();
    const ref = await addDoc(collection(this.db, 'trips', tripId, 'budgetItems'), {
      ...item,
      updatedAt: serverTimestamp(),
      lastModifiedBy: this.stampWriter(),
    });
    return { ...item, id: ref.id, updatedAt: now };
  }

  async updateBudgetItem(
    tripId: string,
    id: string,
    changes: Partial<Omit<BudgetItem, 'id' | 'updatedAt'>>
  ): Promise<void> {
    await updateDoc(doc(this.db, 'trips', tripId, 'budgetItems', id), {
      ...changes,
      updatedAt: serverTimestamp(),
      lastModifiedBy: this.stampWriter(),
    });
  }

  async deleteBudgetItem(tripId: string, id: string): Promise<void> {
    await deleteDoc(doc(this.db, 'trips', tripId, 'budgetItems', id));
  }
}
