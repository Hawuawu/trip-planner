import React from 'react';
import { render } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { theme } from '../theme';
import { useTripStore } from '../store/tripStore';
import { useAuthStore } from '../store/authStore';

export function renderWithProviders(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

// Initial states mirror the store definitions so setState(..., true) fully
// replaces the store state (the second arg triggers replace mode in Zustand).
const tripInitialState = {
  trip: null,
  checkpoints: [],
  alternatives: [],
  bookings: [],
  activityLog: [],
  selectedId: null,
  undoCheckpoint: null,
  repo: null,
  tripId: null,
};

const authInitialState = {
  user: null,
  loading: true,
  service: null,
};

export function resetStores() {
  // Use merge mode (no replace flag) so action functions defined in the store
  // are preserved. Only the data slices are reset between tests.
  useTripStore.setState(tripInitialState);
  useAuthStore.setState(authInitialState);
}
