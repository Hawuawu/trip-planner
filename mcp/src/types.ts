// Duplicated from trip-planner's src/types/index.ts rather than shared via a
// package — the interface is small and changes rarely, and a v1 doesn't
// need the coordination overhead of a shared @trip-planner/types package.
// Keep in sync manually if trip-planner's schema changes.

export type CheckpointType =
  "flight" | "train" | "metro" | "hotel" | "poi" | "other";

export interface Location {
  lat: number;
  lng: number;
  label?: string;
}

export interface Checkpoint {
  id: string;
  type: CheckpointType;
  name: string;
  startTime: string;
  endTime?: string;
  location?: Location;
  notes?: string;
  linkedBookingId?: string;
  updatedAt: string;
}

export interface Alternative {
  id: string;
  type: CheckpointType;
  name: string;
  location?: Location;
  notes?: string;
}

export interface Booking {
  id: string;
  provider: string;
  confirmationNumber: string;
  notes?: string;
}

export interface MemberProfile {
  email: string | null;
  displayName: string | null;
  joinedAt?: string;
}

export interface Trip {
  id: string;
  name: string;
  dateRange: { start: string; end: string };
  memberIds: string[];
  ownerId?: string;
  memberProfiles?: Record<string, MemberProfile>;
}
