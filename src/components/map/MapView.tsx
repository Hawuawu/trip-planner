import { useEffect, useMemo, useState } from 'react';
import Map, { AttributionControl, Source, Layer, useMap } from 'react-map-gl/maplibre';
import type { LineLayerSpecification } from 'maplibre-gl';
import type { FeatureCollection, LineString } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  Box,
  CircularProgress,
  IconButton,
  Paper,
  RadioGroup,
  FormControlLabel,
  Radio,
  Switch,
  Typography,
} from '@mui/material';
import LayersIcon from '@mui/icons-material/Layers';
import { useTripStore } from '../../store/tripStore';
import { CheckpointMarker } from './CheckpointMarker';
import { AlternativeMarker } from './AlternativeMarker';
import { MapZoomControl } from './MapZoomControl';
import { MapOrientationBall } from './MapOrientationBall';
import { MapLocateControl } from './MapLocateControl';
import { UserLocationMarker } from './UserLocationMarker';
import { MAX_PITCH, FOCUS_ZOOM } from './mapConstants';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useDeviceOrientation } from '../../hooks/useDeviceOrientation';
import type { Alternative } from '../../types';
import { getPoiAtPoint, type Poi } from './poi';
import { visibleCheckpoints } from '../../utils/checkpointVisibility';
import { filterAlternatives } from '../../utils/alternativesFilter';
import { collectAllTags } from '../../utils/tags';
import { CheckpointForm } from '../timeline/CheckpointForm';
import { AlternativeForm } from '../alternatives/AlternativeForm';
import { ResponsiveEditDrawer } from '../shared/ResponsiveEditDrawer';

const JAPAN_CENTER = { longitude: 139.69, latitude: 35.68, zoom: 10 };

const STYLES = [
  { name: 'Liberty', url: 'https://tiles.openfreemap.org/styles/liberty' },
  { name: 'Bright', url: 'https://tiles.openfreemap.org/styles/bright' },
  { name: 'Positron', url: 'https://tiles.openfreemap.org/styles/positron' },
] as const;

const ROUTE_LAYER: LineLayerSpecification = {
  id: 'route',
  type: 'line',
  source: 'route',
  paint: {
    'line-color': '#6b7280',
    'line-width': 1.5,
    'line-dasharray': [4, 6],
    'line-opacity': 0.7,
  },
};

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

type MapEditTarget = { kind: 'checkpoint'; id: string } | { kind: 'alternative'; id: string };

function StyleSwitcher({
  current,
  onChange,
  showAlternatives,
  onToggleAlternatives,
}: {
  current: string;
  onChange: (url: string) => void;
  showAlternatives: boolean;
  onToggleAlternatives: (checked: boolean) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Box sx={{ position: 'absolute', top: 8, left: 8, zIndex: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
        <IconButton
          size="small"
          onClick={() => setOpen((v) => !v)}
          onMouseEnter={() => setOpen(true)}
          aria-label="Toggle layer selector"
          sx={{
            bgcolor: 'background.paper',
            border: '2px solid rgba(0,0,0,0.2)',
            borderRadius: 1,
            width: 34,
            height: 34,
            '&:hover': { bgcolor: 'background.paper' },
          }}
        >
          <LayersIcon fontSize="small" />
        </IconButton>
      </Box>
      {open && (
        <Paper
          elevation={2}
          sx={{ mt: 0.5, p: 1, minWidth: 140 }}
          onMouseLeave={() => setOpen(false)}
        >
          <Typography variant="caption" color="text.secondary" sx={{ pl: 0.5 }}>
            Base layer
          </Typography>
          <RadioGroup
            value={current}
            onChange={(e) => {
              onChange(e.target.value);
              setOpen(false);
            }}
          >
            {STYLES.map((s) => (
              <FormControlLabel
                key={s.url}
                value={s.url}
                control={<Radio size="small" />}
                label={<Typography variant="body2">{s.name}</Typography>}
                sx={{ mx: 0, my: -0.25 }}
              />
            ))}
          </RadioGroup>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={showAlternatives}
                onChange={(e) => onToggleAlternatives(e.target.checked)}
              />
            }
            label={<Typography variant="body2">Show alternatives</Typography>}
            sx={{ mx: 0, my: -0.25 }}
          />
        </Paper>
      )}
    </Box>
  );
}

function MapSync({
  locationTracking,
  locationPosition,
  pivoted,
  onUserPan,
}: {
  locationTracking: boolean;
  locationPosition: { lat: number; lng: number } | null;
  pivoted: boolean;
  onUserPan(): void;
}) {
  const { current: map } = useMap();
  const { checkpoints, selectedId, alternatives, selectedAlternativeId } = useTripStore();

  useEffect(() => {
    if (!map) return;
    const selected = checkpoints.find((c) => c.id === selectedId && c.location);
    if (selected?.location) {
      map.easeTo({
        center: [selected.location.lng, selected.location.lat],
        zoom: Math.max(map.getZoom(), FOCUS_ZOOM),
        duration: 300,
      });
    }
  }, [selectedId, checkpoints, map]);

  useEffect(() => {
    if (!map) return;
    const selected = alternatives.find(
      (a: Alternative) => a.id === selectedAlternativeId && a.location
    );
    if (selected?.location) {
      map.easeTo({
        center: [selected.location.lng, selected.location.lat],
        zoom: Math.max(map.getZoom(), FOCUS_ZOOM),
        duration: 300,
      });
    }
  }, [selectedAlternativeId, alternatives, map]);

  // While pivoted, keep the camera centered on the live position as fresh
  // fixes arrive — this is also what makes MapZoomControl's position-anchored
  // zoom feel continuous rather than drifting off-center between fixes.
  useEffect(() => {
    if (!map || !pivoted || !locationPosition) return;
    map.easeTo({ center: [locationPosition.lng, locationPosition.lat], duration: 300 });
  }, [pivoted, locationPosition, map]);

  // A user-initiated drag breaks pivoted mode. MapLibre only fires
  // 'dragstart' for real pointer/touch drags, never for our own programmatic
  // easeTo calls above, so this can't immediately re-trigger itself.
  useEffect(() => {
    if (!map || !locationTracking) return;
    map.on('dragstart', onUserPan);
    return () => {
      map.off('dragstart', onUserPan);
    };
  }, [map, locationTracking, onUserPan]);

  return null;
}

interface Props {
  onPoiSelected?: (poi: Poi) => void;
  onSaved?: (message: string) => void;
  onError?: (message: string) => void;
}

export function MapView({ onPoiSelected, onSaved, onError }: Props) {
  const [mapStyle, setMapStyle] = useState<string>(STYLES[0].url);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [locationTracking, setLocationTracking] = useState(false);
  const [pivoted, setPivoted] = useState(false);
  const {
    checkpoints,
    alternatives,
    alternativesSearchFilter,
    alternativesTagFilter,
    showAlternativesOnMap,
    setShowAlternativesOnMap,
    selectedId,
    selectCheckpoint,
    selectedAlternativeId,
    selectAlternative,
    updateCheckpoint,
    updateAlternative,
    selectedDay,
    selectedRouteId,
    routes,
  } = useTripStore();

  const { position: locationPosition, error: locationError } = useGeolocation(locationTracking);
  const { heading, permissionState, requestPermission } = useDeviceOrientation(locationTracking);

  async function handleToggleLocate() {
    if (locationTracking) {
      if (!pivoted) {
        // Panned away from the live position — re-center and resume
        // following instead of stopping tracking outright.
        setPivoted(true);
        return;
      }
      setLocationTracking(false);
      setPivoted(false);
      return;
    }
    // Must call requestPermission() synchronously within this click handler
    // (before any prior await) — iOS Safari only honors the device-orientation
    // permission prompt when triggered directly by a user gesture.
    await requestPermission();
    setLocationTracking(true);
    setPivoted(true);
  }

  useEffect(() => {
    if (!locationTracking) return;
    if (locationError) {
      onError?.(locationError);
    } else if (permissionState === 'denied') {
      onError?.('Compass access was denied — your position will show without a facing direction.');
    }
  }, [locationTracking, locationError, permissionState, onError]);

  const [editTarget, setEditTarget] = useState<MapEditTarget | null>(null);

  const visible = visibleCheckpoints(checkpoints, { selectedDay, selectedRouteId, routes });
  const withLocation = visible.filter((c) => c.location);

  const visibleAlternatives = filterAlternatives(alternatives, {
    search: alternativesSearchFilter,
    tags: alternativesTagFilter,
  }).filter((a) => a.location);

  const routeGeoJSON: FeatureCollection<LineString> = {
    type: 'FeatureCollection',
    features:
      withLocation.length > 1
        ? [
            {
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: withLocation.map((c) => [c.location!.lng, c.location!.lat]),
              },
              properties: {},
            },
          ]
        : [],
  };

  const editingCheckpoint =
    editTarget?.kind === 'checkpoint' ? checkpoints.find((c) => c.id === editTarget.id) : undefined;
  const editingAlternative =
    editTarget?.kind === 'alternative'
      ? alternatives.find((a) => a.id === editTarget.id)
      : undefined;

  const allTags = useMemo(
    () => collectAllTags(checkpoints, alternatives),
    [checkpoints, alternatives]
  );

  const drawerContent = editingCheckpoint ? (
    <CheckpointForm
      title="Edit checkpoint"
      initial={editingCheckpoint}
      existingTags={allTags}
      onSave={async (data) => {
        try {
          await updateCheckpoint(editingCheckpoint.id, data);
          setEditTarget(null);
          onSaved?.(`Checkpoint "${data.name}" updated.`);
        } catch (err) {
          onError?.(errorMessage(err, `Failed to update "${data.name}".`));
        }
      }}
      onCancel={() => setEditTarget(null)}
    />
  ) : editingAlternative ? (
    <AlternativeForm
      title="Edit alternative"
      initial={editingAlternative}
      existingTags={allTags}
      onSave={async (data) => {
        try {
          await updateAlternative(editingAlternative.id, data);
          setEditTarget(null);
          onSaved?.(`Alternative "${data.name}" updated.`);
        } catch (err) {
          onError?.(errorMessage(err, `Failed to update "${data.name}".`));
        }
      }}
      onCancel={() => setEditTarget(null)}
    />
  ) : null;

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
      <Map
        mapStyle={mapStyle}
        initialViewState={JAPAN_CENTER}
        maxPitch={MAX_PITCH}
        attributionControl={false}
        onClick={(e) => {
          const poi = getPoiAtPoint(e);
          if (poi) onPoiSelected?.(poi);
        }}
        onLoad={() => setMapLoaded(true)}
        style={{ width: '100%', height: '100%' }}
      >
        <StyleSwitcher
          current={mapStyle}
          onChange={setMapStyle}
          showAlternatives={showAlternativesOnMap}
          onToggleAlternatives={setShowAlternativesOnMap}
        />
        <MapSync
          locationTracking={locationTracking}
          locationPosition={locationPosition}
          pivoted={pivoted}
          onUserPan={() => setPivoted(false)}
        />
        <AttributionControl position="top-right" compact />

        <Box
          sx={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            zIndex: 1,
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <MapLocateControl
            tracking={locationTracking}
            pivoted={pivoted}
            onToggle={handleToggleLocate}
          />
          <MapOrientationBall />
          <MapZoomControl pivoted={pivoted} pivotPosition={locationPosition} />
        </Box>

        <Source id="route" type="geojson" data={routeGeoJSON}>
          <Layer {...ROUTE_LAYER} />
        </Source>

        {withLocation.map((cp) => (
          <CheckpointMarker
            key={cp.id}
            checkpoint={cp}
            isSelected={cp.id === selectedId}
            onSelect={() => selectCheckpoint(cp.id === selectedId ? null : cp.id)}
            onEdit={() => {
              // selectCheckpoint toggles — only call it if the tap that opened
              // this popup didn't already select this checkpoint, otherwise
              // it would immediately deselect it again.
              if (selectedId !== cp.id) selectCheckpoint(cp.id);
              setEditTarget({ kind: 'checkpoint', id: cp.id });
            }}
          />
        ))}

        {showAlternativesOnMap &&
          visibleAlternatives.map((alt) => (
            <AlternativeMarker
              key={alt.id}
              alternative={alt}
              isSelected={alt.id === selectedAlternativeId}
              onSelect={() => selectAlternative(alt.id === selectedAlternativeId ? null : alt.id)}
              onEdit={() => {
                if (selectedAlternativeId !== alt.id) selectAlternative(alt.id);
                setEditTarget({ kind: 'alternative', id: alt.id });
              }}
            />
          ))}

        <UserLocationMarker position={locationPosition} heading={heading} />

        <ResponsiveEditDrawer open={!!editTarget} onClose={() => setEditTarget(null)}>
          {drawerContent}
        </ResponsiveEditDrawer>
      </Map>

      {!mapLoaded && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <CircularProgress size={32} />
        </Box>
      )}
    </Box>
  );
}
