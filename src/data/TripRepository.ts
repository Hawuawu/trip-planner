import type { Trip, Checkpoint, Alternative } from '../types';

export interface TripRepository {
  getTrip(tripId: string): Promise<Trip>;
  listTrips(): Promise<Trip[]>;
  createTrip(name: string, dateRange: { start: string; end: string }): Promise<Trip>;
  subscribeToCheckpoints(tripId: string, cb: (checkpoints: Checkpoint[]) => void): () => void;
  addCheckpoint(tripId: string, cp: Omit<Checkpoint, 'id' | 'updatedAt'>): Promise<Checkpoint>;
  updateCheckpoint(tripId: string, id: string, changes: Partial<Omit<Checkpoint, 'id' | 'updatedAt'>>): Promise<void>;
  deleteCheckpoint(tripId: string, id: string): Promise<void>;
  subscribeToAlternatives(tripId: string, cb: (alternatives: Alternative[]) => void): () => void;
  addAlternative(tripId: string, alt: Omit<Alternative, 'id'>): Promise<Alternative>;
  deleteAlternative(tripId: string, id: string): Promise<void>;
  promoteAlternative(tripId: string, alternativeId: string, startTime: string): Promise<void>;
}
