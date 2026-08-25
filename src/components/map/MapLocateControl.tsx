import { Paper, IconButton } from '@mui/material';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import { LOCATION_MARKER_COLOR } from './mapConstants';

interface Props {
  tracking: boolean;
  pivoted: boolean;
  onToggle(): void;
}

function labelFor(tracking: boolean, pivoted: boolean): string {
  if (!tracking) return 'Show my location';
  // Once tracking, a pan away from the live position breaks pivoted mode —
  // the button then re-centers on click instead of stopping tracking, so a
  // second, distinct click is needed to actually turn it off.
  return pivoted ? 'Stop showing my location' : 'Recenter on my location';
}

export function MapLocateControl({ tracking, pivoted, onToggle }: Props) {
  return (
    <Paper elevation={2} sx={{ width: 30, height: 30, overflow: 'hidden' }}>
      <IconButton
        size="small"
        aria-label={labelFor(tracking, pivoted)}
        aria-pressed={tracking}
        onClick={onToggle}
        sx={{ width: 30, height: 30, borderRadius: 0 }}
      >
        <MyLocationIcon
          fontSize="small"
          sx={{ color: tracking ? LOCATION_MARKER_COLOR : undefined }}
        />
      </IconButton>
    </Paper>
  );
}
