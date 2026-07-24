import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  arrayRemove,
  deleteField,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import type { TripRepository } from './TripRepository';
import type {
  Trip,
  Checkpoint,
  Alternative,
  Booking,
  MemberProfile,
  ActivityLogEntry,
  ActivityLogEntryType,
  InviteMemberResult,
} from '../types';

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

function getDb() {
  ensureApp();
  return getFirestore();
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

  private async logActivity(
    tripId: string,
    entry: Omit<ActivityLogEntry, 'id' | 'createdAt' | 'actorUid' | 'actorLabel'>
  ): Promise<void> {
    const user = getAuth().currentUser;
    if (!user) return;
    try {
      await addDoc(collection(this.db, 'trips', tripId, 'activityLog'), {
        ...entry,
        actorUid: user.uid,
        actorLabel: user.displayName ?? user.email ?? user.uid,
        createdAt: serverTimestamp(),
      });
    } catch {
      // best-effort — never let a log failure block the real mutation
    }
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
    });
    return { id: ref.id, name, dateRange, memberIds, ownerId: user.uid, memberProfiles };
  }

  async updateTrip(
    tripId: string,
    changes: Partial<Pick<Trip, 'name' | 'dateRange'>>
  ): Promise<void> {
    await updateDoc(doc(this.db, 'trips', tripId), { ...changes });
    if (changes.name) {
      void this.logActivity(tripId, { type: 'trip_renamed', entityName: changes.name });
    }
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
      limit(100)
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
            count: data.count ?? undefined,
            createdAt: toIso(data.createdAt),
          };
        })
      );
    });
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
    });
    void this.logActivity(tripId, { type: 'checkpoint_added', entityName: cp.name });
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
    });
    void this.logActivity(tripId, {
      type: 'checkpoint_updated',
      entityName: changes.name,
      changedFields: Object.keys(changes),
    });
  }

  async addCheckpoints(
    tripId: string,
    checkpoints: Omit<Checkpoint, 'id' | 'updatedAt'>[]
  ): Promise<Checkpoint[]> {
    const now = new Date().toISOString();
    const batch = writeBatch(this.db);
    const collectionRef = collection(this.db, 'trips', tripId, 'checkpoints');
    const refs = checkpoints.map(() => doc(collectionRef));
    checkpoints.forEach((cp, i) => {
      batch.set(refs[i], { ...cp, updatedAt: serverTimestamp() });
    });
    const actor = getAuth().currentUser;
    if (actor && checkpoints.length > 0) {
      batch.set(doc(collection(this.db, 'trips', tripId, 'activityLog')), {
        type: 'checkpoints_imported' as ActivityLogEntryType,
        actorUid: actor.uid,
        actorLabel: actor.displayName ?? actor.email ?? actor.uid,
        count: checkpoints.length,
        createdAt: serverTimestamp(),
      });
    }
    await batch.commit();
    return checkpoints.map((cp, i) => ({ ...cp, id: refs[i].id, updatedAt: now }));
  }

  async deleteCheckpoint(tripId: string, id: string): Promise<void> {
    const ref = doc(this.db, 'trips', tripId, 'checkpoints', id);
    const snap = await getDoc(ref);
    await deleteDoc(ref);
    void this.logActivity(tripId, {
      type: 'checkpoint_deleted',
      entityName: snap.exists() ? snap.data().name : undefined,
    });
  }

  subscribeToAlternatives(tripId: string, cb: (alternatives: Alternative[]) => void): () => void {
    return onSnapshot(collection(this.db, 'trips', tripId, 'alternatives'), (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Alternative));
    });
  }

  async addAlternative(tripId: string, alt: Omit<Alternative, 'id'>): Promise<Alternative> {
    const ref = await addDoc(collection(this.db, 'trips', tripId, 'alternatives'), alt);
    void this.logActivity(tripId, { type: 'alternative_added', entityName: alt.name });
    return { ...alt, id: ref.id };
  }

  async addAlternatives(
    tripId: string,
    alternatives: Omit<Alternative, 'id'>[]
  ): Promise<Alternative[]> {
    const batch = writeBatch(this.db);
    const collectionRef = collection(this.db, 'trips', tripId, 'alternatives');
    const refs = alternatives.map(() => doc(collectionRef));
    alternatives.forEach((alt, i) => {
      batch.set(refs[i], alt);
    });
    const actor = getAuth().currentUser;
    if (actor && alternatives.length > 0) {
      batch.set(doc(collection(this.db, 'trips', tripId, 'activityLog')), {
        type: 'alternatives_imported' as ActivityLogEntryType,
        actorUid: actor.uid,
        actorLabel: actor.displayName ?? actor.email ?? actor.uid,
        count: alternatives.length,
        createdAt: serverTimestamp(),
      });
    }
    await batch.commit();
    return alternatives.map((alt, i) => ({ ...alt, id: refs[i].id }));
  }

  async updateAlternative(
    tripId: string,
    id: string,
    changes: Partial<Omit<Alternative, 'id'>>
  ): Promise<void> {
    await updateDoc(doc(this.db, 'trips', tripId, 'alternatives', id), { ...changes });
    void this.logActivity(tripId, {
      type: 'alternative_updated',
      entityName: changes.name,
      changedFields: Object.keys(changes),
    });
  }

  async deleteAlternative(tripId: string, id: string): Promise<void> {
    const ref = doc(this.db, 'trips', tripId, 'alternatives', id);
    const snap = await getDoc(ref);
    await deleteDoc(ref);
    void this.logActivity(tripId, {
      type: 'alternative_deleted',
      entityName: snap.exists() ? snap.data().name : undefined,
    });
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
      updatedAt: serverTimestamp(),
    });
    await deleteDoc(altRef);
    void this.logActivity(tripId, { type: 'alternative_promoted', entityName: alt.name });
  }

  subscribeToBookings(tripId: string, cb: (bookings: Booking[]) => void): () => void {
    return onSnapshot(collection(this.db, 'trips', tripId, 'bookings'), (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Booking));
    });
  }

  async addBooking(tripId: string, booking: Omit<Booking, 'id'>): Promise<Booking> {
    const ref = await addDoc(collection(this.db, 'trips', tripId, 'bookings'), booking);
    void this.logActivity(tripId, { type: 'booking_added', entityName: booking.provider });
    return { ...booking, id: ref.id };
  }

  async updateBooking(
    tripId: string,
    id: string,
    changes: Partial<Omit<Booking, 'id'>>
  ): Promise<void> {
    await updateDoc(doc(this.db, 'trips', tripId, 'bookings', id), { ...changes });
    void this.logActivity(tripId, {
      type: 'booking_updated',
      entityName: changes.provider,
      changedFields: Object.keys(changes),
    });
  }

  // Deleting bookings through the app isn't supported yet (#22's refresh
  // scoped delete out entirely, and the UI-side delete button predates that
  // decision) — tracked separately, not implemented here.
  async deleteBooking(_tripId: string, _id: string): Promise<void> {
    throw new Error('Not implemented');
  }
}
