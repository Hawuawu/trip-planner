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

// "You are here" blue for UserLocationMarker — distinct from both
// SELECTED_MARKER_COLOR and checkpoint marker colors so it reads as a
// different kind of thing (live device position), not a selected checkpoint.
export const LOCATION_MARKER_COLOR = '#2563eb';

// Field of view of the heading cone — narrow enough to read as "facing
// direction" rather than a vague half-circle.
export const VIEW_CONE_ANGLE_DEG = 70;
export const VIEW_CONE_RADIUS_PX = 60;

// A fill this light (~0.2) reads as invisible against colorful basemap
// tiles (OpenFreeMap Liberty/Bright) — verified visually. A stroked edge at
// higher opacity keeps the cone legible without the fill overpowering
// what's underneath it.
export const VIEW_CONE_FILL_OPACITY = 0.35;
export const VIEW_CONE_STROKE_OPACITY = 0.7;
