import type {
  Trip,
  Checkpoint,
  Alternative,
  Booking,
  ActivityLogEntry,
  InviteMemberResult,
} from '../types';

export interface TripRepository {
  getTrip(tripId: string): Promise<Trip>;
  subscribeToTrip(tripId: string, cb: (trip: Trip) => void): () => void;
  listTrips(): Promise<Trip[]>;
  createTrip(name: string, dateRange: { start: string; end: string }): Promise<Trip>;
  updateTrip(tripId: string, changes: Partial<Pick<Trip, 'name' | 'dateRange'>>): Promise<void>;
  deleteTrip(tripId: string): Promise<void>;
  inviteMember(tripId: string, email: string): Promise<InviteMemberResult>;
  removeMember(tripId: string, uid: string): Promise<void>;
  leaveTrip(tripId: string): Promise<void>;
  recordAccess(tripId: string): Promise<void>;
  subscribeToActivityLog(tripId: string, cb: (entries: ActivityLogEntry[]) => void): () => void;
  subscribeToCheckpoints(tripId: string, cb: (checkpoints: Checkpoint[]) => void): () => void;
  addCheckpoint(tripId: string, cp: Omit<Checkpoint, 'id' | 'updatedAt'>): Promise<Checkpoint>;
  addCheckpoints(
    tripId: string,
    checkpoints: Omit<Checkpoint, 'id' | 'updatedAt'>[]
  ): Promise<Checkpoint[]>;
  updateCheckpoint(
    tripId: string,
    id: string,
    changes: Partial<Omit<Checkpoint, 'id' | 'updatedAt'>>
  ): Promise<void>;
  deleteCheckpoint(tripId: string, id: string): Promise<void>;
  subscribeToAlternatives(tripId: string, cb: (alternatives: Alternative[]) => void): () => void;
  addAlternative(tripId: string, alt: Omit<Alternative, 'id'>): Promise<Alternative>;
  addAlternatives(tripId: string, alternatives: Omit<Alternative, 'id'>[]): Promise<Alternative[]>;
  updateAlternative(
    tripId: string,
    id: string,
    changes: Partial<Omit<Alternative, 'id'>>
  ): Promise<void>;
  deleteAlternative(tripId: string, id: string): Promise<void>;
  promoteAlternative(tripId: string, alternativeId: string, startTime: string): Promise<void>;
  subscribeToBookings(tripId: string, cb: (bookings: Booking[]) => void): () => void;
  addBooking(tripId: string, booking: Omit<Booking, 'id'>): Promise<Booking>;
  updateBooking(tripId: string, id: string, changes: Partial<Omit<Booking, 'id'>>): Promise<void>;
  deleteBooking(tripId: string, id: string): Promise<void>;
}
