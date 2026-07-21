import { useState } from 'react';
import { Box, CircularProgress } from '@mui/material';
import App from './App';
import { PendingApprovalPage } from './components/auth/PendingApprovalPage';
import { SignInPage } from './components/auth/SignInPage';
import { TripSelectorScreen } from './components/trips/TripSelectorScreen';
import { useAuthStore } from './store/authStore';
import { useTripStore } from './store/tripStore';
import type { TripRepository } from './data/TripRepository';

interface Props {
  tripRepo: TripRepository;
}

export function Root({ tripRepo }: Props) {
  const { user, loading } = useAuthStore();
  const storedTripId = localStorage.getItem('trip-planner:activeTripId');
  const [activeTripId, setActiveTripId] = useState<string | null>(storedTripId);

  function handleSelect(tripId: string) {
    localStorage.setItem('trip-planner:activeTripId', tripId);
    useTripStore.getState().init(tripId, tripRepo);
    setActiveTripId(tripId);
  }

  function handleBack() {
    localStorage.removeItem('trip-planner:activeTripId');
    setActiveTripId(null);
  }

  if (loading) {
    return (
      <Box
        sx={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (!user) {
    return <SignInPage />;
  }

  // Signed in but not approved (#35): the appAccess claim gates everything.
  // Local mode sets appAccess: true on its fake user.
  if (user.appAccess !== true) {
    return <PendingApprovalPage />;
  }

  if (!activeTripId) {
    return <TripSelectorScreen repo={tripRepo} onSelect={handleSelect} />;
  }

  // Initialise store once on first render with an active trip id.
  // If activeTripId was already set from localStorage, we still call init so
  // the store is populated before App mounts.
  useTripStore.getState().init(activeTripId, tripRepo);

  return <App onBack={handleBack} />;
}
