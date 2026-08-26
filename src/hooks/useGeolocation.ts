import { useEffect, useState } from 'react';

export interface GeolocationPositionValue {
  lat: number;
  lng: number;
  accuracy: number;
}

// GeolocationPositionError's PERMISSION_DENIED/POSITION_UNAVAILABLE/TIMEOUT
// constants live on the global constructor, which jsdom doesn't implement —
// use the standard numeric codes directly so this works in tests too.
function errorMessage(code: number): string {
  switch (code) {
    case 1: // PERMISSION_DENIED
      return 'Location access was denied.';
    case 2: // POSITION_UNAVAILABLE
      return 'Your location is currently unavailable.';
    case 3: // TIMEOUT
      return 'Timed out while getting your location.';
    default:
      return 'Failed to get your location.';
  }
}

export function useGeolocation(enabled: boolean) {
  const [position, setPosition] = useState<GeolocationPositionValue | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setPosition(null);
      return;
    }

    if (!navigator.geolocation) {
      setError('Geolocation is not supported on this device.');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setError(null);
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => setError(errorMessage(err.code)),
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled]);

  return { position, error };
}
