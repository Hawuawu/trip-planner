import { Paper, IconButton } from '@mui/material';
import AddLocationAltIcon from '@mui/icons-material/AddLocationAlt';
import { DROP_PIN_MARKER_COLOR } from './mapConstants';

interface Props {
  active: boolean;
  onToggle(): void;
}

function labelFor(active: boolean): string {
  return active ? 'Cancel adding point of interest' : 'Add point of interest';
}

export function MapDropPinControl({ active, onToggle }: Props) {
  return (
    <Paper elevation={2} sx={{ width: 30, height: 30, overflow: 'hidden' }}>
      <IconButton
        size="small"
        aria-label={labelFor(active)}
        aria-pressed={active}
        onClick={(e) => {
          // See PoiPopup for the same pattern: this button is rendered
          // inside the map's own children, so an un-stopped click would
          // bubble into the map's onClick and immediately re-trigger a
          // basemap POI hit-test with the stale pre-toggle state.
          e.stopPropagation();
          onToggle();
        }}
        sx={{ width: 30, height: 30, borderRadius: 0 }}
      >
        <AddLocationAltIcon
          fontSize="small"
          sx={{ color: active ? DROP_PIN_MARKER_COLOR : undefined }}
        />
      </IconButton>
    </Paper>
  );
}
