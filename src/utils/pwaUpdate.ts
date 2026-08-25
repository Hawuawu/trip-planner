// Installed-PWA users can leave the app backgrounded (not navigated) for
// days — browsers only natively re-check a service worker on navigation/page
// load or an OS-throttled ~24h background check, so a resumed-but-not-reopened
// PWA never triggers either. This polls `registration.update()` on an
// interval and immediately again whenever the tab/app becomes visible
// (covers resuming a backgrounded phone PWA). The reload itself isn't on a
// timer — `registerType: 'autoUpdate'` (vite.config.ts) reloads automatically
// as soon as a poll finds a new service worker. No update prompt/toast by
// design (#128) — a forceful, unannounced reload is the intended UX.
//
// `visibilitychange` (not `focus`) is the resume signal: `focus` also fires
// on far more common in-session events (switching to a picker/keyboard and
// back, alt-tabbing between windows on desktop) that aren't "this PWA sat
// backgrounded," so it would just add redundant checks without a better
// signal for the case this feature actually targets.
export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 60 minutes

export function schedulePeriodicUpdateCheck(
  swUrl: string,
  registration: ServiceWorkerRegistration,
  intervalMs: number = UPDATE_CHECK_INTERVAL_MS
): () => void {
  async function checkForUpdate(): Promise<void> {
    // Offline — the fetch below would just fail; don't bother.
    if (navigator.onLine === false) return;
    // A worker is already installing from a previous check — don't race it
    // with a second concurrent update() call.
    if (registration.installing) return;

    try {
      // Bypass the HTTP cache and any SW-level caching of the SW script
      // itself so a stale cached copy can't mask a real new deploy.
      const response = await fetch(swUrl, {
        cache: 'no-store',
        headers: {
          cache: 'no-store',
          'cache-control': 'no-cache',
        },
      });
      // Only ask the SW to re-check if the script is actually reachable and
      // healthy — a non-200 (captive portal, transient 5xx, misconfigured
      // host) isn't a signal that a new version exists.
      if (response.status === 200) {
        await registration.update();
      }
    } catch {
      // Network hiccup — the next interval tick or visibility check retries.
    }
  }

  const intervalId = setInterval(checkForUpdate, intervalMs);

  function handleVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      void checkForUpdate();
    }
  }
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // main.tsx calls this once at bootstrap with no unmount path to wire it
  // to, but returning a disposer is still the idiomatic shape here — it's
  // what makes this testable (tests can tear down cleanly between cases)
  // and leaves the door open if this ever needs to run somewhere with a
  // lifecycle (e.g. a future settings toggle) instead of module top-level.
  return function dispose(): void {
    clearInterval(intervalId);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}
