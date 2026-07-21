import { Paper, IconButton, Divider } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { useMap } from 'react-map-gl/maplibre';
import { ZOOM_DURATION_MS } from './mapConstants';

export function MapZoomControl() {
  const { current: map } = useMap();

  return (
    <Paper
      elevation={2}
      sx={{ display: 'flex', flexDirection: 'column', width: 30, overflow: 'hidden' }}
    >
      <IconButton
        size="small"
        aria-label="Zoom in"
        onClick={() => map?.zoomIn({ duration: ZOOM_DURATION_MS })}
        sx={{ width: 30, height: 30, borderRadius: 0 }}
      >
        <AddIcon fontSize="small" />
      </IconButton>
      <Divider />
      <IconButton
        size="small"
        aria-label="Zoom out"
        onClick={() => map?.zoomOut({ duration: ZOOM_DURATION_MS })}
        sx={{ width: 30, height: 30, borderRadius: 0 }}
      >
        <RemoveIcon fontSize="small" />
      </IconButton>
    </Paper>
  );
}
