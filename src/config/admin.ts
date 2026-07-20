// The single app admin: the only account that can create/cancel app invites
// and revoke app access. Used here for UI gating only — enforcement lives in
// firestore.rules (isAppAdmin) and functions/src/adminConfig.ts; keep all
// three in sync.
export const ADMIN_EMAIL = 'hawuawu@gmail.com';

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase() === ADMIN_EMAIL;
}
