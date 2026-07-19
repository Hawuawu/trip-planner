import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  onSnapshot,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import type { TripRepository } from './TripRepository';
import type { Trip, Checkpoint, Alternative, Booking } from '../types';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

function getDb() {
  if (!getApps().length) initializeApp(firebaseConfig);
  return getFirestore();
}

function toIso(val: unknown): string {
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

export class FirebaseTripRepository implements TripRepository {
  private db = getDb();

  async getTrip(tripId: string): Promise<Trip> {
    const snap = await getDoc(doc(this.db, 'trips', tripId));
    if (!snap.exists()) throw new Error(`Trip ${tripId} not found`);
    const d = snap.data();
    return {
      id: snap.id,
      name: d.name,
      dateRange: d.dateRange,
      memberIds: d.memberIds ?? [],
      ownerId: d.ownerId,
    };
  }

  async listTrips(): Promise<Trip[]> {
    const uid = getAuth().currentUser?.uid;
    if (!uid) return [];
    const snap = await getDocs(
      query(collection(this.db, 'trips'), where('memberIds', 'array-contains', uid))
    );
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name,
        dateRange: data.dateRange,
        memberIds: data.memberIds ?? [],
        ownerId: data.ownerId,
      };
    });
  }

  async createTrip(name: string, dateRange: { start: string; end: string }): Promise<Trip> {
    const uid = getAuth().currentUser?.uid;
    if (!uid) throw new Error('Must be signed in to create a trip');
    const memberIds = [uid];
    const ref = await addDoc(collection(this.db, 'trips'), {
      name,
      dateRange,
      memberIds,
      ownerId: uid,
    });
    return { id: ref.id, name, dateRange, memberIds, ownerId: uid };
  }

  async updateTrip(
    tripId: string,
    changes: Partial<Pick<Trip, 'name' | 'dateRange'>>
  ): Promise<void> {
    await updateDoc(doc(this.db, 'trips', tripId), { ...changes });
  }

  async deleteTrip(tripId: string): Promise<void> {
    await deleteDoc(doc(this.db, 'trips', tripId));
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
  }

  async deleteCheckpoint(tripId: string, id: string): Promise<void> {
    await deleteDoc(doc(this.db, 'trips', tripId, 'checkpoints', id));
  }

  subscribeToAlternatives(tripId: string, cb: (alternatives: Alternative[]) => void): () => void {
    return onSnapshot(collection(this.db, 'trips', tripId, 'alternatives'), (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Alternative));
    });
  }

  async addAlternative(tripId: string, alt: Omit<Alternative, 'id'>): Promise<Alternative> {
    const ref = await addDoc(collection(this.db, 'trips', tripId, 'alternatives'), alt);
    return { ...alt, id: ref.id };
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
      updatedAt: serverTimestamp(),
    });
    await deleteDoc(altRef);
  }

  // ── Bookings — to be implemented in the Firebase issue ───────────────────────

  subscribeToBookings(_tripId: string, cb: (bookings: Booking[]) => void): () => void {
    cb([]);
    return () => {};
  }

  async addBooking(_tripId: string, _booking: Omit<Booking, 'id'>): Promise<Booking> {
    throw new Error('Not implemented');
  }

  async updateBooking(
    _tripId: string,
    _id: string,
    _changes: Partial<Omit<Booking, 'id'>>
  ): Promise<void> {
    throw new Error('Not implemented');
  }

  async deleteBooking(_tripId: string, _id: string): Promise<void> {
    throw new Error('Not implemented');
  }
}
