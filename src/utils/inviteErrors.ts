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
