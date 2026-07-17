import React, { useState } from 'react';
import App from './App';
import { TripSelectorScreen } from './components/trips/TripSelectorScreen';
import { useTripStore } from './store/tripStore';
import type { TripRepository } from './data/TripRepository';

interface Props {
  tripRepo: TripRepository;
}

export function Root({ tripRepo }: Props) {
  const storedTripId = localStorage.getItem('trip-planner:activeTripId');
  const [activeTripId, setActiveTripId] = useState<string | null>(storedTripId);

  function handleSelect(tripId: string) {
    localStorage.setItem('trip-planner:activeTripId', tripId);
    useTripStore.getState().init(tripId, tripRepo);
    setActiveTripId(tripId);
  }

  if (!activeTripId) {
    return <TripSelectorScreen repo={tripRepo} onSelect={handleSelect} />;
  }

  // Initialise store once on first render with an active trip id.
  // If activeTripId was already set from localStorage, we still call init so
  // the store is populated before App mounts.
  useTripStore.getState().init(activeTripId, tripRepo);

  return <App />;
}
