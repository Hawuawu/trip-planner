export type CheckpointType = 'flight' | 'train' | 'metro' | 'hotel' | 'poi' | 'other';

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

export interface Trip {
  id: string;
  name: string;
  dateRange: { start: string; end: string };
  memberIds: string[];
}

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}
