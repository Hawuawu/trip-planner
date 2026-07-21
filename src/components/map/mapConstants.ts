export const ZOOM_DURATION_MS = 220;

// MapLibre's own engine default and the point past which it calls pitch
// "experimental" — shared by <Map maxPitch> and the orientation ball's clamp
// so native gestures and the ball control can never drift out of sync.
export const MAX_PITCH = 60;

export const BEARING_SENSITIVITY = 0.6; // degrees of bearing per px of horizontal drag
export const PITCH_SENSITIVITY = 0.35; // degrees of pitch per px of vertical drag (drag up tilts)
export const RESET_DURATION_MS = 300;
