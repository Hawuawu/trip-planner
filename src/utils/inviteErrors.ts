// Firebase's callable-functions client throws a FirebaseError whose .message
// sometimes falls back to the bare error code fragment (e.g. "internal",
// "not-found") when the backend didn't send a proper HttpsError message —
// notably when the target Cloud Function isn't deployed/reachable at all.
// Surfacing that raw fragment reads as a broken UI, so swap it for a generic,
// actionable message instead of showing it verbatim.
export function extractInviteErrorMessage(err: unknown): string {
  const fallback = 'Something went wrong sending the invite. Please try again.';
  if (!(err instanceof Error) || !err.message) return fallback;
  const code = (err as { code?: unknown }).code;
  const codeTail = typeof code === 'string' ? code.split('/').pop() : undefined;
  const looksLikeRawCode = Boolean(
    codeTail && err.message.trim().toLowerCase() === codeTail.toLowerCase()
  );
  return looksLikeRawCode ? fallback : err.message;
}

// A sign-in rejected by the enforceAllowlist blocking function surfaces on
// signInWithPopup's rejection in an SDK-version-dependent shape: recent
// firebase-js-sdk versions keep the HttpsError message readable, while older
// ones bury it as a JSON blob inside a generic auth/internal-error message.
// Try the JSON blob first, then fall back to a cleaned-up err.message, then a
// generic message. Returns null for user-cancelled popups — closing the popup
// isn't an error worth displaying.
const CANCELLED_SIGN_IN_CODES = new Set([
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
]);

export function extractSignInErrorMessage(err: unknown): string | null {
  const fallback = 'Sign-in failed. Please try again.';
  if (!(err instanceof Error)) return fallback;

  const code = (err as { code?: unknown }).code;
  if (typeof code === 'string' && CANCELLED_SIGN_IN_CODES.has(code)) return null;

  const embedded = err.message.match(/\{[\s\S]*\}/);
  if (embedded) {
    try {
      const parsed = JSON.parse(embedded[0]) as { error?: { message?: unknown } };
      if (typeof parsed.error?.message === 'string' && parsed.error.message) {
        return parsed.error.message;
      }
    } catch {
      // not a JSON payload after all — fall through to the cleanup path
    }
  }

  const cleaned = err.message
    .replace(/^Firebase:\s*/, '')
    .replace(/\s*\(auth\/[^)]+\)\.?$/, '')
    .trim();
  if (!cleaned || cleaned.toLowerCase() === 'error') return fallback;
  return cleaned;
}
