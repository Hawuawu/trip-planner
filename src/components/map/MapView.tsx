import { useEffect, useState } from 'react';
import Map, { NavigationControl, Source, Layer, useMap } from 'react-map-gl/maplibre';
import type { LineLayerSpecification } from 'maplibre-gl';
import type { FeatureCollection, LineString } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  Box,
  IconButton,
  Paper,
  RadioGroup,
  FormControlLabel,
  Radio,
  Typography,
} from '@mui/material';
import LayersIcon from '@mui/icons-material/Layers';
import { useTripStore } from '../../store/tripStore';
import { CheckpointMarker } from './CheckpointMarker';

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

function StyleSwitcher({
  current,
  onChange,
}: {
  current: string;
  onChange: (url: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Box sx={{ position: 'absolute', bottom: 32, right: 8, zIndex: 1 }}>
      {open && (
        <Paper
          elevation={2}
          sx={{ mb: 0.5, p: 1, minWidth: 140 }}
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
        </Paper>
      )}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
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
    </Box>
  );
}

function MapSync() {
  const { current: map } = useMap();
  const { checkpoints, selectedId } = useTripStore();

  useEffect(() => {
    if (!map) return;
    const selected = checkpoints.find((c) => c.id === selectedId && c.location);
    if (selected?.location) {
      map.easeTo({ center: [selected.location.lng, selected.location.lat], duration: 300 });
    }
  }, [selectedId, checkpoints, map]);

  return null;
}

export function MapView() {
  const [mapStyle, setMapStyle] = useState<string>(STYLES[0].url);
  const { checkpoints, selectedId, selectCheckpoint } = useTripStore();

  const withLocation = checkpoints.filter((c) => c.location);

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

  return (
    <Map
      mapStyle={mapStyle}
      initialViewState={JAPAN_CENTER}
      style={{ width: '100%', height: '100%' }}
    >
      <NavigationControl position="top-right" />
      <StyleSwitcher current={mapStyle} onChange={setMapStyle} />
      <MapSync />

      <Source id="route" type="geojson" data={routeGeoJSON}>
        <Layer {...ROUTE_LAYER} />
      </Source>

      {withLocation.map((cp) => (
        <CheckpointMarker
          key={cp.id}
          checkpoint={cp}
          isSelected={cp.id === selectedId}
          onSelect={() => selectCheckpoint(cp.id === selectedId ? null : cp.id)}
        />
      ))}
    </Map>
  );
}
