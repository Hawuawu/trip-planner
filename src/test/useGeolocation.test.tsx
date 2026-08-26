import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useGeolocation } from '../hooks/useGeolocation';

const watchPosition = vi.fn();
const clearWatch = vi.fn();

function setGeolocation(value: Geolocation | undefined) {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value,
  });
}

// Deliberately don't restore navigator.geolocation to its original value here:
// RTL's automatic afterEach cleanup (unmounting still-mounted hooks) can run
// after this file's own afterEach, and an unmount's effect-cleanup calls
// navigator.geolocation.clearWatch — restoring to `undefined` first would
// break that. Each test sets navigator.geolocation explicitly before use, so
// leaving the last value in place between tests in this file is harmless.
afterEach(() => {
  watchPosition.mockReset();
  clearWatch.mockReset();
});

describe('useGeolocation', () => {
  it('does nothing while disabled', () => {
    setGeolocation({ watchPosition, clearWatch } as unknown as Geolocation);
    const { result } = renderHook(() => useGeolocation(false));
    expect(watchPosition).not.toHaveBeenCalled();
    expect(result.current).toEqual({ position: null, error: null });
  });

  it('reports the position from watchPosition success callbacks', async () => {
    setGeolocation({ watchPosition, clearWatch } as unknown as Geolocation);
    watchPosition.mockImplementation((success: PositionCallback) => {
      success({
        coords: { latitude: 35.68, longitude: 139.69, accuracy: 12 },
      } as GeolocationPosition);
      return 1;
    });

    const { result } = renderHook(() => useGeolocation(true));

    await waitFor(() =>
      expect(result.current.position).toEqual({ lat: 35.68, lng: 139.69, accuracy: 12 })
    );
    expect(result.current.error).toBeNull();
  });

  it('maps a PERMISSION_DENIED error to a friendly message', async () => {
    setGeolocation({ watchPosition, clearWatch } as unknown as Geolocation);
    watchPosition.mockImplementation((_success: PositionCallback, error: PositionErrorCallback) => {
      error({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError);
      return 1;
    });

    const { result } = renderHook(() => useGeolocation(true));

    await waitFor(() => expect(result.current.error).toBe('Location access was denied.'));
    expect(result.current.position).toBeNull();
  });

  it('clears the watch on unmount', () => {
    setGeolocation({
      watchPosition: watchPosition.mockReturnValue(7),
      clearWatch,
    } as unknown as Geolocation);
    const { unmount } = renderHook(() => useGeolocation(true));
    unmount();
    expect(clearWatch).toHaveBeenCalledWith(7);
  });

  it('clears the watch and resets position when disabled after being enabled', () => {
    setGeolocation({
      watchPosition: watchPosition.mockReturnValue(7),
      clearWatch,
    } as unknown as Geolocation);
    const { result, rerender } = renderHook(({ enabled }) => useGeolocation(enabled), {
      initialProps: { enabled: true },
    });
    rerender({ enabled: false });
    expect(clearWatch).toHaveBeenCalledWith(7);
    expect(result.current.position).toBeNull();
  });

  it('sets a friendly error when geolocation is unsupported', () => {
    setGeolocation(undefined);
    const { result } = renderHook(() => useGeolocation(true));
    expect(result.current.error).toBe('Geolocation is not supported on this device.');
  });
});
