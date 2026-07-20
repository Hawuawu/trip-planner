import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';

// The single app admin: the only account allowed to create/cancel app invites
// and revoke app access. Mirrored in firestore.rules (isAppAdmin) and
// src/config/admin.ts (UI gating) — keep all three in sync.
export const ADMIN_EMAIL = 'hawuawu@gmail.com';

export function assertIsAdmin(request: CallableRequest<unknown>): void {
  const email = request.auth?.token?.email;
  if (typeof email !== 'string' || email.toLowerCase() !== ADMIN_EMAIL) {
    throw new HttpsError('permission-denied', 'Only the app admin can perform this action.');
  }
}
