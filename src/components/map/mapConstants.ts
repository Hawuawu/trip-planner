export const ZOOM_DURATION_MS = 220;

// Zoom level a checkpoint/alternative is focused to when selected — close
// enough to distinguish a single POI, but selection only zooms in to reach
// it, never zooms a closer-in view back out.
export const FOCUS_ZOOM = 15;

// MapLibre's own engine default and the point past which it calls pitch
// "experimental" — shared by <Map maxPitch> and the orientation ball's clamp
// so native gestures and the ball control can never drift out of sync.
export const MAX_PITCH = 60;

export const BEARING_SENSITIVITY = 0.6; // degrees of bearing per px of horizontal drag
export const PITCH_SENSITIVITY = 0.35; // degrees of pitch per px of vertical drag (drag up tilts)
export const RESET_DURATION_MS = 300;

export const KEYBOARD_BEARING_STEP = 15; // degrees of bearing per arrow-key press
export const KEYBOARD_PITCH_STEP = 10; // degrees of pitch per arrow-key press

// Shared "this marker is selected" color for both CheckpointMarker and
// AlternativeMarker — deliberately distinct from either marker's own
// unselected/category color so selection reads as a state change, not a
// shade of the same hue.
export const SELECTED_MARKER_COLOR = '#e94560';
