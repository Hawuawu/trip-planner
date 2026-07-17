import React from 'react';
import { render } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { useTripStore } from '../store/tripStore';
import { useAuthStore } from '../store/authStore';

// Duplicate of the theme in main.tsx — we cannot import main.tsx because it
// has Firebase init and ReactDOM.render side effects that break the test env.
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1a1a2e' },
    secondary: { main: '#e94560' },
    background: { default: '#f8f8f6', paper: '#ffffff' },
    text: { primary: '#1a1a2e', secondary: '#6b7280' },
  },
  typography: {
    fontFamily: '"Inter", "Helvetica Neue", Arial, sans-serif',
    h6: { fontWeight: 600, letterSpacing: '-0.01em' },
    body2: { fontSize: '0.8125rem' },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiPaper: { defaultProps: { elevation: 0 } },
  },
});

export function renderWithProviders(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

// Initial states mirror the store definitions so setState(..., true) fully
// replaces the store state (the second arg triggers replace mode in Zustand).
const tripInitialState = {
  trip: null,
  checkpoints: [],
  alternatives: [],
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
