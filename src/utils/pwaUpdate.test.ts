import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { schedulePeriodicUpdateCheck, UPDATE_CHECK_INTERVAL_MS } from './pwaUpdate';

const SW_URL = '/sw.js';

function makeRegistration(
  overrides: { installing?: ServiceWorker | null } = {}
): ServiceWorkerRegistration {
  return {
    installing: overrides.installing ?? null,
    update: vi.fn().mockResolvedValue(undefined),
  } as unknown as ServiceWorkerRegistration;
}

// Save and restore the real navigator.onLine/document.visibilityState
// descriptors between tests (same pattern as offlineBanner.test.tsx).
const originalOnLineDescriptor = Object.getOwnPropertyDescriptor(navigator, 'onLine');
const originalVisibilityDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState');

function setOnline(value: boolean): void {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => value });
}

function setVisibilityState(value: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value });
}

describe('schedulePeriodicUpdateCheck', () => {
  let dispose: (() => void) | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200 } as Response));
    setOnline(true);
    setVisibilityState('hidden');
  });

  afterEach(() => {
    dispose?.();
    dispose = undefined;
    vi.useRealTimers();
    vi.unstubAllGlobals();
    if (originalOnLineDescriptor)
      Object.defineProperty(navigator, 'onLine', originalOnLineDescriptor);
    if (originalVisibilityDescriptor) {
      Object.defineProperty(document, 'visibilityState', originalVisibilityDescriptor);
    }
  });

  it('fetches the SW file with cache: no-store and calls registration.update() on each interval tick', async () => {
    const registration = makeRegistration();
    dispose = schedulePeriodicUpdateCheck(SW_URL, registration, 1000);

    await vi.advanceTimersByTimeAsync(1000);
    expect(fetch).toHaveBeenCalledWith(SW_URL, expect.objectContaining({ cache: 'no-store' }));
    expect(registration.update).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(registration.update).toHaveBeenCalledTimes(2);
  });

  it('exports a 60-minute default interval', () => {
    expect(UPDATE_CHECK_INTERVAL_MS).toBe(60 * 60 * 1000);
  });

  it('skips the check when navigator.onLine is false', async () => {
    setOnline(false);
    const registration = makeRegistration();
    dispose = schedulePeriodicUpdateCheck(SW_URL, registration, 1000);

    await vi.advanceTimersByTimeAsync(1000);
    expect(fetch).not.toHaveBeenCalled();
    expect(registration.update).not.toHaveBeenCalled();
  });

  it('skips the check while a service worker install is already in progress', async () => {
    const registration = makeRegistration({ installing: {} as ServiceWorker });
    dispose = schedulePeriodicUpdateCheck(SW_URL, registration, 1000);

    await vi.advanceTimersByTimeAsync(1000);
    expect(fetch).not.toHaveBeenCalled();
    expect(registration.update).not.toHaveBeenCalled();
  });

  it('does not call update() when the SW file fetch does not return 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 404 } as Response));
    const registration = makeRegistration();
    dispose = schedulePeriodicUpdateCheck(SW_URL, registration, 1000);

    await vi.advanceTimersByTimeAsync(1000);
    expect(registration.update).not.toHaveBeenCalled();
  });

  it('swallows a fetch rejection instead of throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const registration = makeRegistration();
    dispose = schedulePeriodicUpdateCheck(SW_URL, registration, 1000);

    // If checkForUpdate() didn't catch the rejection, this would reject too.
    await vi.advanceTimersByTimeAsync(1000);
    expect(registration.update).not.toHaveBeenCalled();
  });

  it('runs an immediate check when the page becomes visible', async () => {
    const registration = makeRegistration();
    dispose = schedulePeriodicUpdateCheck(SW_URL, registration, 60 * 60 * 1000);

    setVisibilityState('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(registration.update).toHaveBeenCalledTimes(1);
  });

  it('does not run a check when visibilitychange fires while the page is hidden', async () => {
    const registration = makeRegistration();
    dispose = schedulePeriodicUpdateCheck(SW_URL, registration, 60 * 60 * 1000);

    setVisibilityState('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);

    expect(fetch).not.toHaveBeenCalled();
  });

  it('stops checking after the returned dispose function is called', async () => {
    const registration = makeRegistration();
    const cleanup = schedulePeriodicUpdateCheck(SW_URL, registration, 1000);
    cleanup();

    await vi.advanceTimersByTimeAsync(5000);
    setVisibilityState('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);

    expect(fetch).not.toHaveBeenCalled();
  });
});
