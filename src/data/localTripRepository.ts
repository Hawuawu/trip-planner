import type { TripRepository } from './TripRepository';
import type { Trip, Checkpoint, Alternative, Booking } from '../types';

const DEMO_TRIP: Trip = {
  id: 'demo',
  name: 'Japan 2026',
  dateRange: { start: '2026-10-01', end: '2026-10-14' },
  memberIds: ['local-user'],
  ownerId: 'local-user',
};

const now = new Date().toISOString();

const SEED_CHECKPOINTS: Checkpoint[] = [
  {
    id: '1',
    type: 'flight',
    name: 'JFK → NRT',
    startTime: '2026-10-01T14:00:00.000Z',
    endTime: '2026-10-02T17:00:00.000Z',
    notes: 'JL 005, seat 32A',
    updatedAt: now,
  },
  {
    id: '2',
    type: 'hotel',
    name: 'Shinjuku Granbell Hotel',
    startTime: '2026-10-02T15:00:00.000Z',
    endTime: '2026-10-05T11:00:00.000Z',
    location: { lat: 35.6938, lng: 139.7034, label: 'Shinjuku, Tokyo' },
    updatedAt: now,
  },
  {
    id: '3',
    type: 'train',
    name: 'Shinkansen Tokyo → Kyoto',
    startTime: '2026-10-05T12:00:00.000Z',
    endTime: '2026-10-05T14:15:00.000Z',
    notes: 'Nozomi 37, car 7',
    updatedAt: now,
  },
  {
    id: '4',
    type: 'hotel',
    name: 'Kyoto Granvia',
    startTime: '2026-10-05T15:00:00.000Z',
    endTime: '2026-10-08T11:00:00.000Z',
    location: { lat: 34.9856, lng: 135.7579, label: 'Kyoto Station' },
    updatedAt: now,
  },
  {
    id: '5',
    type: 'poi',
    name: 'Fushimi Inari-taisha',
    startTime: '2026-10-06T08:00:00.000Z',
    location: { lat: 34.9671, lng: 135.7727, label: 'Fushimi, Kyoto' },
    updatedAt: now,
  },
  {
    id: '6',
    type: 'flight',
    name: 'NRT → JFK',
    startTime: '2026-10-14T10:00:00.000Z',
    endTime: '2026-10-14T14:00:00.000Z',
    notes: 'JL 006',
    updatedAt: now,
  },
];

const SEED_ALTERNATIVES: Alternative[] = [
  {
    id: 'a1',
    type: 'poi',
    name: 'teamLab Borderless',
    notes: 'Azabudai Hills, Tokyo',
    location: { lat: 35.6591, lng: 139.7138, label: 'Azabudai Hills, Tokyo' },
  },
  {
    id: 'a2',
    type: 'poi',
    name: 'Nishiki Market',
    location: { lat: 35.0053, lng: 135.7659, label: 'Nishiki, Kyoto' },
  },
];

const LS_CP = 'trip-planner:checkpoints';
const LS_ALT = 'trip-planner:alternatives';
const LS_BOOKINGS = 'trip-planner:bookings';
const LS_TRIPS = 'trip-planner:trips';

function loadTrips(): Trip[] {
  try {
    const raw = localStorage.getItem(LS_TRIPS);
    return raw ? (JSON.parse(raw) as Trip[]) : [DEMO_TRIP];
  } catch {
    return [DEMO_TRIP];
  }
}

function saveTrips(t: Trip[]) {
  localStorage.setItem(LS_TRIPS, JSON.stringify(t));
}

function loadCp(): Checkpoint[] {
  try {
    const raw = localStorage.getItem(LS_CP);
    return raw ? (JSON.parse(raw) as Checkpoint[]) : structuredClone(SEED_CHECKPOINTS);
  } catch {
    return structuredClone(SEED_CHECKPOINTS);
  }
}

function saveCp(c: Checkpoint[]) {
  localStorage.setItem(LS_CP, JSON.stringify(c));
}

function loadAlt(): Alternative[] {
  try {
    const raw = localStorage.getItem(LS_ALT);
    return raw ? (JSON.parse(raw) as Alternative[]) : structuredClone(SEED_ALTERNATIVES);
  } catch {
    return structuredClone(SEED_ALTERNATIVES);
  }
}

function saveAlt(a: Alternative[]) {
  localStorage.setItem(LS_ALT, JSON.stringify(a));
}

function loadBookings(): Booking[] {
  try {
    const raw = localStorage.getItem(LS_BOOKINGS);
    return raw ? (JSON.parse(raw) as Booking[]) : [];
  } catch {
    return [];
  }
}

function saveBookings(b: Booking[]) {
  localStorage.setItem(LS_BOOKINGS, JSON.stringify(b));
}

export class LocalTripRepository implements TripRepository {
  private cpSubs = new Map<string, Set<(c: Checkpoint[]) => void>>();
  private altSubs = new Map<string, Set<(a: Alternative[]) => void>>();
  private bookingSubs = new Map<string, Set<(b: Booking[]) => void>>();

  async getTrip(tripId: string): Promise<Trip> {
    return { ...DEMO_TRIP, id: tripId };
  }

  subscribeToCheckpoints(tripId: string, cb: (c: Checkpoint[]) => void): () => void {
    if (!this.cpSubs.has(tripId)) this.cpSubs.set(tripId, new Set());
    this.cpSubs.get(tripId)!.add(cb);
    cb(this.sortedCp());
    return () => {
      this.cpSubs.get(tripId)?.delete(cb);
    };
  }

  private sortedCp(): Checkpoint[] {
    return loadCp().sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  private notifyCp(tripId: string) {
    this.cpSubs.get(tripId)?.forEach((cb) => cb(this.sortedCp()));
  }

  async addCheckpoint(
    tripId: string,
    cp: Omit<Checkpoint, 'id' | 'updatedAt'>
  ): Promise<Checkpoint> {
    const saved: Checkpoint = {
      ...cp,
      id: `local-${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };
    saveCp([...loadCp(), saved]);
    this.notifyCp(tripId);
    return saved;
  }

  async updateCheckpoint(
    tripId: string,
    id: string,
    changes: Partial<Omit<Checkpoint, 'id' | 'updatedAt'>>
  ): Promise<void> {
    saveCp(
      loadCp().map((c) =>
        c.id === id ? { ...c, ...changes, updatedAt: new Date().toISOString() } : c
      )
    );
    this.notifyCp(tripId);
  }

  async deleteCheckpoint(tripId: string, id: string): Promise<void> {
    saveCp(loadCp().filter((c) => c.id !== id));
    this.notifyCp(tripId);
  }

  subscribeToAlternatives(tripId: string, cb: (a: Alternative[]) => void): () => void {
    if (!this.altSubs.has(tripId)) this.altSubs.set(tripId, new Set());
    this.altSubs.get(tripId)!.add(cb);
    cb(loadAlt());
    return () => {
      this.altSubs.get(tripId)?.delete(cb);
    };
  }

  private notifyAlt(tripId: string) {
    this.altSubs.get(tripId)?.forEach((cb) => cb(loadAlt()));
  }

  async addAlternative(tripId: string, alt: Omit<Alternative, 'id'>): Promise<Alternative> {
    const saved: Alternative = { ...alt, id: `local-alt-${Date.now()}` };
    saveAlt([...loadAlt(), saved]);
    this.notifyAlt(tripId);
    return saved;
  }

  async deleteAlternative(tripId: string, id: string): Promise<void> {
    saveAlt(loadAlt().filter((a) => a.id !== id));
    this.notifyAlt(tripId);
  }

  async promoteAlternative(
    tripId: string,
    alternativeId: string,
    startTime: string
  ): Promise<void> {
    const alt = loadAlt().find((a) => a.id === alternativeId);
    if (!alt) throw new Error('Alternative not found');
    await this.addCheckpoint(tripId, {
      type: alt.type,
      name: alt.name,
      startTime,
      location: alt.location,
      notes: alt.notes,
    });
    await this.deleteAlternative(tripId, alternativeId);
  }

  subscribeToBookings(tripId: string, cb: (b: Booking[]) => void): () => void {
    if (!this.bookingSubs.has(tripId)) this.bookingSubs.set(tripId, new Set());
    this.bookingSubs.get(tripId)!.add(cb);
    cb(loadBookings());
    return () => {
      this.bookingSubs.get(tripId)?.delete(cb);
    };
  }

  private notifyBookings(tripId: string) {
    this.bookingSubs.get(tripId)?.forEach((cb) => cb(loadBookings()));
  }

  async addBooking(tripId: string, booking: Omit<Booking, 'id'>): Promise<Booking> {
    const saved: Booking = { ...booking, id: `local-booking-${Date.now()}` };
    saveBookings([...loadBookings(), saved]);
    this.notifyBookings(tripId);
    return saved;
  }

  async updateBooking(
    tripId: string,
    id: string,
    changes: Partial<Omit<Booking, 'id'>>
  ): Promise<void> {
    saveBookings(loadBookings().map((b) => (b.id === id ? { ...b, ...changes } : b)));
    this.notifyBookings(tripId);
  }

  async deleteBooking(tripId: string, id: string): Promise<void> {
    saveBookings(loadBookings().filter((b) => b.id !== id));
    this.notifyBookings(tripId);
  }

  async listTrips(): Promise<Trip[]> {
    return loadTrips();
  }

  async createTrip(name: string, dateRange: { start: string; end: string }): Promise<Trip> {
    const trips = loadTrips();
    const trip: Trip = {
      id: `trip-${Date.now()}`,
      name,
      dateRange,
      memberIds: ['local-user'],
      ownerId: 'local-user',
    };
    const existing = trips.find((t) => t.id === DEMO_TRIP.id);
    saveTrips([...(existing ? trips : [DEMO_TRIP, ...trips]), trip]);
    return trip;
  }

  async updateTrip(
    tripId: string,
    changes: Partial<Pick<Trip, 'name' | 'dateRange'>>
  ): Promise<void> {
    saveTrips(loadTrips().map((t) => (t.id === tripId ? { ...t, ...changes } : t)));
  }

  async deleteTrip(tripId: string): Promise<void> {
    saveTrips(loadTrips().filter((t) => t.id !== tripId));
  }
}
