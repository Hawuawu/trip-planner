import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { registerSW } from 'virtual:pwa-register';
import { theme } from './theme';
import { Root } from './Root';
import { FirebaseAuthService } from './data/firebaseAuthService';
import { FirebaseTripRepository } from './data/firebaseTripRepository';
import { LocalTripRepository } from './data/localTripRepository';
import { useAuthStore } from './store/authStore';
import { schedulePeriodicUpdateCheck } from './utils/pwaUpdate';
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
    user: {
      uid: 'local-user',
      email: null,
      displayName: 'Local User',
      appAccess: true,
      admin: true,
    },
    loading: false,
  });
}

// Register the service worker and keep polling for updates for as long as
// the installed PWA stays open (#128). `injectRegister: false` in
// vite.config.ts stops the plugin from auto-injecting its own bare
// registration script, so this is the only place the SW gets registered.
// `immediate: true` skips waiting for the `load` event — irrelevant in
// practice here since this already runs at the top of the entry module.
// In dev (no `devOptions.enabled` on the VitePWA plugin), this virtual
// module resolves to a hardcoded no-op, so this is a safe unconditional call.
registerSW({
  immediate: true,
  onRegisteredSW(swUrl, registration) {
    if (!registration) return;
    schedulePeriodicUpdateCheck(swUrl, registration);
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Root tripRepo={tripRepo} />
    </ThemeProvider>
  </React.StrictMode>
);
