import { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Box } from '@mui/material';
import { useTripStore } from '../../store/tripStore';
import { CheckpointMarker } from './CheckpointMarker';

const JAPAN_CENTER: [number, number] = [35.68, 139.69];

function MapSync() {
  const map = useMap();
  const { checkpoints, selectedId } = useTripStore();
  useEffect(() => {
    const selected = checkpoints.find(c => c.id === selectedId && c.location);
    if (selected?.location) {
      map.panTo([selected.location.lat, selected.location.lng], { animate: true });
    }
  }, [selectedId, checkpoints, map]);
  return null;
}

export function MapView() {
  const { checkpoints, selectedId, selectCheckpoint } = useTripStore();

  const withLocation = checkpoints.filter(c => c.location);
  const routeCoords: [number, number][] = withLocation.map(c => [c.location!.lat, c.location!.lng]);

  const center: [number, number] = withLocation.length > 0
    ? [withLocation[0].location!.lat, withLocation[0].location!.lng]
    : JAPAN_CENTER;

  return (
    <Box sx={{ height: '100%', width: '100%', '& .leaflet-container': { height: '100%', width: '100%' } }}>
      <MapContainer center={center} zoom={10} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapSync />
        {routeCoords.length > 1 && (
          <Polyline positions={routeCoords} pathOptions={{ color: '#6b7280', weight: 1.5, dashArray: '4 6', opacity: 0.7 }} />
        )}
        {withLocation.map(cp => (
          <CheckpointMarker
            key={cp.id}
            checkpoint={cp}
            isSelected={cp.id === selectedId}
            onSelect={() => selectCheckpoint(cp.id === selectedId ? null : cp.id)}
          />
        ))}
      </MapContainer>
    </Box>
  );
}
