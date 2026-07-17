import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider, CssBaseline, createTheme } from '@mui/material';
import { Root } from './Root';
import { FirebaseAuthService } from './data/firebaseAuthService';
import { FirebaseTripRepository } from './data/firebaseTripRepository';
import { LocalTripRepository } from './data/localTripRepository';
import { useAuthStore } from './store/authStore';
import type { TripRepository } from './data/TripRepository';

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

const useLocal = import.meta.env.VITE_USE_LOCAL === 'true' || !import.meta.env.VITE_FIREBASE_API_KEY;

const authService = useLocal ? null : new FirebaseAuthService();
const tripRepo: TripRepository = useLocal ? new LocalTripRepository() : new FirebaseTripRepository();

if (authService) {
  useAuthStore.getState().init(authService);
} else {
  useAuthStore.setState({ user: { uid: 'local-user', email: null, displayName: 'Local User' }, loading: false });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Root tripRepo={tripRepo} />
    </ThemeProvider>
  </React.StrictMode>,
);
