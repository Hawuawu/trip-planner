import { getFirestore, doc, getDoc, getDocs, collection, query, where, addDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, Timestamp, type Firestore } from 'firebase/firestore';
import type { Auth } from 'firebase/auth';
import type { Trip, Checkpoint, Alternative, Booking, MemberProfile } from '../types.js';

function toIso(val: unknown): string {
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

function toMemberProfiles(raw: unknown): Record<string, MemberProfile> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  return Object.fromEntries(
    Object.entries(raw as Record<string, { email?: string | null; displayName?: string | null }>).map(
      ([uid, p]) => [uid, { email: p.email ?? null, displayName: p.displayName ?? null }]
    )
  );
}

function toTrip(id: string, d: Record<string, unknown>): Trip {
  return {
    id,
    name: d.name as string,
    dateRange: d.dateRange as Trip['dateRange'],
    memberIds: (d.memberIds as string[]) ?? [],
    ownerId: d.ownerId as string | undefined,
    memberProfiles: toMemberProfiles(d.memberProfiles),
  };
}

function toCheckpoint(id: string, d: Record<string, unknown>): Checkpoint {
  return {
    id,
    type: d.type as Checkpoint['type'],
    name: d.name as string,
    startTime: toIso(d.startTime),
    endTime: d.endTime ? toIso(d.endTime) : undefined,
    location: (d.location as Checkpoint['location']) ?? undefined,
    notes: (d.notes as string) ?? undefined,
    linkedBookingId: (d.linkedBookingId as string) ?? undefined,
    updatedAt: toIso(d.updatedAt),
  };
}

function toAlternative(id: string, d: Record<string, unknown>): Alternative {
  return { id, ...(d as Omit<Alternative, 'id'>) };
}

function toBooking(id: string, d: Record<string, unknown>): Booking {
  return { id, ...(d as Omit<Booking, 'id'>) };
}

// One-shot Firestore reads/writes (getDoc/getDocs, not onSnapshot) — an MCP
// tool call is a single request/response, not a long-lived UI subscription,
// so there's nothing to push realtime updates to. This mirrors trip-planner's
// FirebaseTripRepository (src/data/firebaseTripRepository.ts) method-for-
// method but flattens every subscribeToX into a one-shot listX, matching
// MCP.md's original "collapse subscriptions into list tools" call.
export class FirebaseClientTripRepository {
  private db: Firestore;

  constructor(private auth: Auth) {
    this.db = getFirestore(auth.app);
  }

  private requireUid(): string {
    const uid = this.auth.currentUser?.uid;
    if (!uid) throw new Error('Not signed in');
    return uid;
  }

  async listTrips(): Promise<Trip[]> {
    const uid = this.requireUid();
    const snap = await getDocs(query(collection(this.db, 'trips'), where('memberIds', 'array-contains', uid)));
    return snap.docs.map((d) => toTrip(d.id, d.data()));
  }

  async getTrip(tripId: string): Promise<Trip> {
    const snap = await getDoc(doc(this.db, 'trips', tripId));
    if (!snap.exists()) throw new Error(`Trip ${tripId} not found`);
    return toTrip(snap.id, snap.data());
  }

  async createTrip(name: string, dateRange: { start: string; end: string }): Promise<Trip> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Not signed in');
    const memberIds = [user.uid];
    const memberProfiles: Record<string, MemberProfile> = {
      [user.uid]: { email: user.email, displayName: user.displayName },
    };
    const ref = await addDoc(collection(this.db, 'trips'), { name, dateRange, memberIds, ownerId: user.uid, memberProfiles });
    return { id: ref.id, name, dateRange, memberIds, ownerId: user.uid, memberProfiles };
  }

  async updateTrip(tripId: string, changes: Partial<Pick<Trip, 'name' | 'dateRange'>>): Promise<void> {
    await updateDoc(doc(this.db, 'trips', tripId), { ...changes });
  }

  async listCheckpoints(tripId: string): Promise<Checkpoint[]> {
    const snap = await getDocs(collection(this.db, 'trips', tripId, 'checkpoints'));
    const checkpoints = snap.docs.map((d) => toCheckpoint(d.id, d.data()));
    checkpoints.sort((a, b) => a.startTime.localeCompare(b.startTime));
    return checkpoints;
  }

  async getCheckpoint(tripId: string, checkpointId: string): Promise<Checkpoint> {
    const snap = await getDoc(doc(this.db, 'trips', tripId, 'checkpoints', checkpointId));
    if (!snap.exists()) throw new Error(`Checkpoint ${checkpointId} not found`);
    return toCheckpoint(snap.id, snap.data());
  }

  async addCheckpoint(tripId: string, cp: Omit<Checkpoint, 'id' | 'updatedAt'>): Promise<Checkpoint> {
    const now = new Date().toISOString();
    const ref = await addDoc(collection(this.db, 'trips', tripId, 'checkpoints'), { ...cp, updatedAt: serverTimestamp() });
    return { ...cp, id: ref.id, updatedAt: now };
  }

  async addCheckpoints(tripId: string, checkpoints: Omit<Checkpoint, 'id' | 'updatedAt'>[]): Promise<Checkpoint[]> {
    const now = new Date().toISOString();
    const batch = writeBatch(this.db);
    const collectionRef = collection(this.db, 'trips', tripId, 'checkpoints');
    const refs = checkpoints.map(() => doc(collectionRef));
    checkpoints.forEach((cp, i) => batch.set(refs[i], { ...cp, updatedAt: serverTimestamp() }));
    await batch.commit();
    return checkpoints.map((cp, i) => ({ ...cp, id: refs[i].id, updatedAt: now }));
  }

  async updateCheckpoint(tripId: string, id: string, changes: Partial<Omit<Checkpoint, 'id' | 'updatedAt'>>): Promise<void> {
    await updateDoc(doc(this.db, 'trips', tripId, 'checkpoints', id), { ...changes, updatedAt: serverTimestamp() });
  }

  async listAlternatives(tripId: string): Promise<Alternative[]> {
    const snap = await getDocs(collection(this.db, 'trips', tripId, 'alternatives'));
    return snap.docs.map((d) => toAlternative(d.id, d.data()));
  }

  async addAlternative(tripId: string, alt: Omit<Alternative, 'id'>): Promise<Alternative> {
    const ref = await addDoc(collection(this.db, 'trips', tripId, 'alternatives'), alt);
    return { ...alt, id: ref.id };
  }

  async addAlternatives(tripId: string, alternatives: Omit<Alternative, 'id'>[]): Promise<Alternative[]> {
    const batch = writeBatch(this.db);
    const collectionRef = collection(this.db, 'trips', tripId, 'alternatives');
    const refs = alternatives.map(() => doc(collectionRef));
    alternatives.forEach((alt, i) => batch.set(refs[i], alt));
    await batch.commit();
    return alternatives.map((alt, i) => ({ ...alt, id: refs[i].id }));
  }

  async updateAlternative(tripId: string, id: string, changes: Partial<Omit<Alternative, 'id'>>): Promise<void> {
    await updateDoc(doc(this.db, 'trips', tripId, 'alternatives', id), { ...changes });
  }

  async promoteAlternative(tripId: string, alternativeId: string, startTime: string): Promise<void> {
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
    // Matches trip-planner's own promoteAlternative (src/data/
    // firebaseTripRepository.ts): deletion here is an atomic part of an
    // existing, already-shipped promotion workflow (confirmed with the user
    // — the "no delete tools" scope decision was about standalone delete_*
    // tools, not this).
    await deleteDoc(altRef);
  }

  async listBookings(tripId: string): Promise<Booking[]> {
    const snap = await getDocs(collection(this.db, 'trips', tripId, 'bookings'));
    return snap.docs.map((d) => toBooking(d.id, d.data()));
  }

  async addBooking(tripId: string, booking: Omit<Booking, 'id'>): Promise<Booking> {
    const ref = await addDoc(collection(this.db, 'trips', tripId, 'bookings'), booking);
    return { ...booking, id: ref.id };
  }

  async updateBooking(tripId: string, id: string, changes: Partial<Omit<Booking, 'id'>>): Promise<void> {
    await updateDoc(doc(this.db, 'trips', tripId, 'bookings', id), { ...changes });
  }
}
