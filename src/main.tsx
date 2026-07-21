import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { theme } from './theme';
import { Root } from './Root';
import { FirebaseAuthService } from './data/firebaseAuthService';
import { FirebaseTripRepository } from './data/firebaseTripRepository';
import { LocalTripRepository } from './data/localTripRepository';
import { useAuthStore } from './store/authStore';
import type { TripRepository } from './data/TripRepository';

const useLocal =
  import.meta.env.VITE_USE_LOCAL === 'true' || !import.meta.env.VITE_FIREBASE_API_KEY;

const authService = useLocal ? null : new FirebaseAuthService();
const tripRepo: TripRepository = useLocal
  ? new LocalTripRepository()
  : new FirebaseTripRepository();

if (authService) {
  useAuthStore.getState().init(authService);
} else {
  useAuthStore.setState({
    user: { uid: 'local-user', email: null, displayName: 'Local User', appAccess: true },
    loading: false,
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Root tripRepo={tripRepo} />
    </ThemeProvider>
  </React.StrictMode>
);
