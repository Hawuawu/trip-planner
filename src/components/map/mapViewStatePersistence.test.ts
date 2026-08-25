import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadPersistedMapViewState, savePersistedMapViewState } from './mapViewStatePersistence';

const MAP_VIEW_STATE_KEY = 'trip-planner:mapViewState';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe('mapViewStatePersistence', () => {
  it('returns null when nothing is stored', () => {
    expect(loadPersistedMapViewState()).toBeNull();
  });

  it('returns null on malformed JSON', () => {
    localStorage.setItem(MAP_VIEW_STATE_KEY, '{not valid json');
    expect(loadPersistedMapViewState()).toBeNull();
  });

  it('returns null on partial/invalid data', () => {
    localStorage.setItem(
      MAP_VIEW_STATE_KEY,
      JSON.stringify({ longitude: 139.69, latitude: 35.68 })
    );
    expect(loadPersistedMapViewState()).toBeNull();
  });

  it('returns null when a field is not a finite number', () => {
    localStorage.setItem(
      MAP_VIEW_STATE_KEY,
      JSON.stringify({ longitude: 139.69, latitude: 35.68, zoom: 'far', bearing: 0, pitch: 0 })
    );
    expect(loadPersistedMapViewState()).toBeNull();
  });

  it('round-trips a value written by save', () => {
    const viewState = { longitude: 135.75, latitude: 35.0, zoom: 12.5, bearing: 45, pitch: 30 };
    savePersistedMapViewState(viewState);
    expect(loadPersistedMapViewState()).toEqual(viewState);
  });

  it('writes the exact key and shape', () => {
    savePersistedMapViewState({ longitude: 1, latitude: 2, zoom: 3, bearing: 4, pitch: 5 });
    expect(JSON.parse(localStorage.getItem(MAP_VIEW_STATE_KEY)!)).toEqual({
      longitude: 1,
      latitude: 2,
      zoom: 3,
      bearing: 4,
      pitch: 5,
    });
  });
});
