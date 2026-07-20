import type { Trip } from '../types';

export function canManage(trip: Trip, uid: string | undefined): boolean {
  return !trip.ownerId || trip.ownerId === uid;
}
