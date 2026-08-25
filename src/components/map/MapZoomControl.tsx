import { Paper, IconButton, Divider } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { useMap } from 'react-map-gl/maplibre';
import { ZOOM_DURATION_MS } from './mapConstants';

interface Props {
  pivoted: boolean;
  pivotPosition: { lat: number; lng: number } | null;
}

export function MapZoomControl({ pivoted, pivotPosition }: Props) {
  const { current: map } = useMap();

  function zoomBy(delta: number) {
    if (!map) return;
    if (pivoted && pivotPosition) {
      map.easeTo({
        center: [pivotPosition.lng, pivotPosition.lat],
        zoom: map.getZoom() + delta,
        duration: ZOOM_DURATION_MS,
      });
      return;
    }
    if (delta > 0) {
      map.zoomIn({ duration: ZOOM_DURATION_MS });
    } else {
      map.zoomOut({ duration: ZOOM_DURATION_MS });
    }
  }

  return (
    <Paper
      elevation={2}
      sx={{ display: 'flex', flexDirection: 'column', width: 30, overflow: 'hidden' }}
    >
      <IconButton
        size="small"
        aria-label="Zoom in"
        onClick={() => zoomBy(1)}
        sx={{ width: 30, height: 30, borderRadius: 0 }}
      >
        <AddIcon fontSize="small" />
      </IconButton>
      <Divider />
      <IconButton
        size="small"
        aria-label="Zoom out"
        onClick={() => zoomBy(-1)}
        sx={{ width: 30, height: 30, borderRadius: 0 }}
      >
        <RemoveIcon fontSize="small" />
      </IconButton>
    </Paper>
  );
}
