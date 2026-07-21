import { describe, it, expect, vi } from 'vitest';
import { getPoiAtPoint } from './poi';
import type { MapLayerMouseEvent } from 'react-map-gl/maplibre';

function makeEvent(overrides: {
  layers?: { id: string; 'source-layer'?: string }[];
  queryResult?: unknown[];
}): MapLayerMouseEvent {
  const layers = overrides.layers ?? [];
  const queryResult = overrides.queryResult ?? [];
  const queryRenderedFeatures = vi.fn(() => queryResult);
  return {
    point: { x: 10, y: 20 },
    target: {
      getStyle: () => ({ layers }),
      queryRenderedFeatures,
    },
  } as unknown as MapLayerMouseEvent;
}

describe('getPoiAtPoint', () => {
  it('returns null when the current style has no poi source-layer (Positron)', () => {
    const e = makeEvent({ layers: [{ id: 'water', 'source-layer': 'water' }] });
    expect(getPoiAtPoint(e)).toBeNull();
  });

  it('queries only the poi source-layer ids and returns null if nothing is found', () => {
    const e = makeEvent({
      layers: [
        { id: 'poi_r7', 'source-layer': 'poi' },
        { id: 'water', 'source-layer': 'water' },
      ],
      queryResult: [],
    });
    expect(getPoiAtPoint(e)).toBeNull();
    expect(e.target.queryRenderedFeatures).toHaveBeenCalledWith(
      { x: 10, y: 20 },
      { layers: ['poi_r7'] }
    );
  });

  it('returns null for a non-Point feature', () => {
    const e = makeEvent({
      layers: [{ id: 'poi_r7', 'source-layer': 'poi' }],
      queryResult: [{ geometry: { type: 'Polygon' }, properties: { name: 'Park' } }],
    });
    expect(getPoiAtPoint(e)).toBeNull();
  });

  it('returns null when the feature has no name', () => {
    const e = makeEvent({
      layers: [{ id: 'poi_r7', 'source-layer': 'poi' }],
      queryResult: [{ geometry: { type: 'Point', coordinates: [139.7, 35.7] }, properties: {} }],
    });
    expect(getPoiAtPoint(e)).toBeNull();
  });

  it('extracts name and coordinates from a matched POI feature', () => {
    const e = makeEvent({
      layers: [{ id: 'poi_r7', 'source-layer': 'poi' }],
      queryResult: [
        {
          geometry: { type: 'Point', coordinates: [139.7, 35.7] },
          properties: { name: 'Sensō-ji', class: 'place_of_worship' },
        },
      ],
    });
    expect(getPoiAtPoint(e)).toEqual({
      name: 'Sensō-ji',
      location: { lat: 35.7, lng: 139.7 },
    });
  });

  it('prefers name_en over name when both are present', () => {
    const e = makeEvent({
      layers: [{ id: 'poi_r7', 'source-layer': 'poi' }],
      queryResult: [
        {
          geometry: { type: 'Point', coordinates: [139.7, 35.7] },
          properties: { name: '浅草寺', name_en: 'Sensoji Temple' },
        },
      ],
    });
    expect(getPoiAtPoint(e)?.name).toBe('Sensoji Temple');
  });
});
