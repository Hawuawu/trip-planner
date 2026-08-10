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
//
// The loading flags are a deliberate exception: the store defaults them to
// `true` to reproduce real app boot (see tripStore.ts init()), but tests
// want an already-settled screen without having to call init() themselves,
// so they're reset to `false` here. Don't "fix" this back to `true` — that
// would silently reintroduce the stale-empty-state flash issue #78 fixed.
const tripInitialState = {
  trip: null,
  checkpoints: [],
  alternatives: [],
  bookings: [],
  routes: [],
  wikiSections: [],
  budgets: [],
  budgetSections: [],
  budgetItems: [],
  activityLog: [],
  selectedId: null,
  selectedDay: null,
  selectedRouteId: null,
  selectedAlternativeId: null,
  budgetNavigationTarget: null,
  alternativesSearchFilter: '',
  alternativesTagFilter: [],
  showAlternativesOnMap: true,
  undoCheckpoint: null,
  repo: null,
  tripId: null,
  tripLoading: false,
  checkpointsLoading: false,
  alternativesLoading: false,
};

const authInitialState = {
  user: null,
  loading: true,
  service: null,
  authError: null,
};

export function resetStores() {
  // Use merge mode (no replace flag) so action functions defined in the store
  // are preserved. Only the data slices are reset between tests.
  useTripStore.setState(tripInitialState);
  useAuthStore.setState(authInitialState);
}
