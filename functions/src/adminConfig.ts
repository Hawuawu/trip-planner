import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';

// Admin status is data-driven, not a hardcoded identity: it comes from the
// `role` field on a user's allowedUsers doc, stamped into the `admin` custom
// claim at sign-in (see authGate.ts's stampAppAccess). Promoting/demoting an
// admin is the setAdminRole callable in appAccess.ts — a Firestore edit plus
// a claim update, not a code change. This just checks the claim.
export function assertIsAdmin(request: CallableRequest<unknown>): void {
  if (request.auth?.token?.admin !== true) {
    throw new HttpsError('permission-denied', 'Only an app admin can perform this action.');
  }
}
