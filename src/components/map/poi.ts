import type { MapLayerMouseEvent } from 'react-map-gl/maplibre';
import type { Location } from '../../types';

export interface Poi {
  name: string;
  location: Location;
}

// OpenFreeMap's Liberty/Bright styles carry POI icons+labels on several
// zoom-banded layers (all source-layer "poi"); Positron ships none at all.
// Reading the layer list from the live style (rather than hardcoding layer
// ids) means this keeps working if those ids ever change, and naturally
// no-ops on Positron instead of throwing — queryRenderedFeatures throws if
// asked for a layer id that doesn't exist in the current style.
export function getPoiAtPoint(e: MapLayerMouseEvent): Poi | null {
  const map = e.target;
  const poiLayerIds = (map.getStyle()?.layers ?? [])
    .filter((l) => 'source-layer' in l && l['source-layer'] === 'poi')
    .map((l) => l.id);
  if (poiLayerIds.length === 0) return null;

  const [feature] = map.queryRenderedFeatures(e.point, { layers: poiLayerIds });
  if (!feature || feature.geometry.type !== 'Point') return null;

  const props = feature.properties ?? {};
  const name: string | undefined = props.name_en ?? props.name;
  if (!name) return null;

  const [lng, lat] = feature.geometry.coordinates;
  return { name, location: { lat, lng } };
}
