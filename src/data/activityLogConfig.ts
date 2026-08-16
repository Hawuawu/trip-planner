// Shared between FirebaseTripRepository and LocalTripRepository so both
// backends stay in lockstep, and between tripStore's live-subscription cap
// and its history pagination.
export const ACTIVITY_LOG_PAGE_SIZE = 20;
export const ACTIVITY_LOG_LIVE_WINDOW = 20;
