const MAP_VIEW_STATE_KEY = 'trip-planner:mapViewState';

export interface PersistedMapViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  bearing: number;
  pitch: number;
}

function isPersistedMapViewState(value: unknown): value is PersistedMapViewState {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    Number.isFinite(v.longitude) &&
    Number.isFinite(v.latitude) &&
    Number.isFinite(v.zoom) &&
    Number.isFinite(v.bearing) &&
    Number.isFinite(v.pitch)
  );
}

export function loadPersistedMapViewState(): PersistedMapViewState | null {
  try {
    const raw = localStorage.getItem(MAP_VIEW_STATE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isPersistedMapViewState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function savePersistedMapViewState(viewState: PersistedMapViewState): void {
  localStorage.setItem(
    MAP_VIEW_STATE_KEY,
    JSON.stringify({
      longitude: viewState.longitude,
      latitude: viewState.latitude,
      zoom: viewState.zoom,
      bearing: viewState.bearing,
      pitch: viewState.pitch,
    })
  );
}
