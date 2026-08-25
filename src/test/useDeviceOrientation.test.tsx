import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useDeviceOrientation } from '../hooks/useDeviceOrientation';

function dispatchOrientation(eventName: string, fields: Record<string, unknown>) {
  const event = Object.assign(new Event(eventName), fields);
  window.dispatchEvent(event);
}

afterEach(() => {
  vi.unstubAllGlobals();
  // 'ondeviceorientationabsolute' is added directly to window (not via
  // stubGlobal, which only covers globalThis properties cleanly here) —
  // remove it explicitly so it doesn't leak into later tests.
  delete (window as unknown as Record<string, unknown>).ondeviceorientationabsolute;
});

describe('useDeviceOrientation', () => {
  it('starts unsupported when DeviceOrientationEvent is absent', () => {
    vi.stubGlobal('DeviceOrientationEvent', undefined);
    const { result } = renderHook(() => useDeviceOrientation(true));
    expect(result.current.permissionState).toBe('unsupported');
    expect(result.current.heading).toBeNull();
  });

  it('starts prompt when DeviceOrientationEvent exists', () => {
    vi.stubGlobal('DeviceOrientationEvent', function () {});
    const { result } = renderHook(() => useDeviceOrientation(true));
    expect(result.current.permissionState).toBe('prompt');
  });

  describe('requestPermission', () => {
    it('sets granted immediately when the browser has no requestPermission gate', async () => {
      vi.stubGlobal('DeviceOrientationEvent', function () {});
      const { result } = renderHook(() => useDeviceOrientation(true));

      await act(async () => {
        await result.current.requestPermission();
      });

      expect(result.current.permissionState).toBe('granted');
    });

    it('resolves granted/denied from the iOS-style gated requestPermission', async () => {
      const requestPermission = vi.fn().mockResolvedValueOnce('denied');
      vi.stubGlobal('DeviceOrientationEvent', { requestPermission });
      const { result } = renderHook(() => useDeviceOrientation(true));

      await act(async () => {
        await result.current.requestPermission();
      });

      expect(requestPermission).toHaveBeenCalledTimes(1);
      expect(result.current.permissionState).toBe('denied');
    });
  });

  describe('heading', () => {
    beforeEach(() => {
      vi.stubGlobal('DeviceOrientationEvent', function () {});
    });

    it('stays null until permission is granted, even while enabled', () => {
      const { result } = renderHook(() => useDeviceOrientation(true));
      dispatchOrientation('deviceorientation', { alpha: 90 });
      expect(result.current.heading).toBeNull();
    });

    it('prefers webkitCompassHeading over the alpha fallback once granted', async () => {
      const { result } = renderHook(() => useDeviceOrientation(true));
      await act(async () => {
        await result.current.requestPermission();
      });

      act(() => {
        dispatchOrientation('deviceorientation', { alpha: 90, webkitCompassHeading: 42 });
      });

      await waitFor(() => expect(result.current.heading).toBe(42));
    });

    it('falls back to 360 - alpha when webkitCompassHeading is absent', async () => {
      const { result } = renderHook(() => useDeviceOrientation(true));
      await act(async () => {
        await result.current.requestPermission();
      });

      act(() => {
        dispatchOrientation('deviceorientation', { alpha: 90 });
      });

      await waitFor(() => expect(result.current.heading).toBe(270));
    });

    it('listens on deviceorientationabsolute when the browser supports it', async () => {
      Object.defineProperty(window, 'ondeviceorientationabsolute', {
        configurable: true,
        value: null,
      });
      const { result } = renderHook(() => useDeviceOrientation(true));
      await act(async () => {
        await result.current.requestPermission();
      });

      act(() => {
        dispatchOrientation('deviceorientationabsolute', { alpha: 10 });
      });
      await waitFor(() => expect(result.current.heading).toBe(350));

      act(() => {
        dispatchOrientation('deviceorientation', { alpha: 0 });
      });
      expect(result.current.heading).toBe(350);
    });

    it('resets heading to null and stops listening when disabled', async () => {
      const { result, rerender } = renderHook(({ enabled }) => useDeviceOrientation(enabled), {
        initialProps: { enabled: true },
      });
      await act(async () => {
        await result.current.requestPermission();
      });
      act(() => {
        dispatchOrientation('deviceorientation', { alpha: 90 });
      });
      await waitFor(() => expect(result.current.heading).toBe(270));

      rerender({ enabled: false });
      expect(result.current.heading).toBeNull();

      act(() => {
        dispatchOrientation('deviceorientation', { alpha: 0 });
      });
      expect(result.current.heading).toBeNull();
    });
  });
});
