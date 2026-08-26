import { Marker, Popup } from 'react-map-gl/maplibre';
import { Box, IconButton } from '@mui/material';
import EditIcon from '@mui/icons-material/EditOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { CheckpointIcon } from '../timeline/CheckpointIcon';
import type { Checkpoint } from '../../types';
import { SELECTED_MARKER_COLOR } from './mapConstants';

interface Props {
  checkpoint: Checkpoint;
  isSelected: boolean;
  onSelect(): void;
  onViewDetails(): void;
  onEdit(): void;
}

export function CheckpointMarker({
  checkpoint,
  isSelected,
  onSelect,
  onViewDetails,
  onEdit,
}: Props) {
  if (!checkpoint.location) return null;

  const color = isSelected ? SELECTED_MARKER_COLOR : '#1a1a2e';

  return (
    <>
      <Marker
        longitude={checkpoint.location.lng}
        latitude={checkpoint.location.lat}
        anchor="center"
        onClick={(e) => {
          e.originalEvent.stopPropagation();
          onSelect();
        }}
      >
        <div
          style={{
            background: isSelected ? SELECTED_MARKER_COLOR : '#fff',
            border: `2px solid ${color}`,
            borderRadius: '50%',
            width: isSelected ? 32 : 28,
            height: isSelected ? 32 : 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isSelected ? '#fff' : color,
            cursor: 'pointer',
          }}
        >
          <CheckpointIcon
            type={checkpoint.type}
            style={{ width: isSelected ? 22 : 20, height: isSelected ? 22 : 20 }}
          />
        </div>
      </Marker>

      {isSelected && (
        <Popup
          longitude={checkpoint.location.lng}
          latitude={checkpoint.location.lat}
          anchor="bottom"
          onClose={onSelect}
          closeOnClick={false}
        >
          <Box sx={{ minWidth: 0 }}>
            <Box>
              <strong>{checkpoint.name}</strong>
              {checkpoint.location.label && (
                <>
                  <br />
                  {checkpoint.location.label}
                </>
              )}
            </Box>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 0.5,
                mt: 0.5,
                pt: 0.5,
                borderTop: '1px solid',
                borderColor: 'divider',
              }}
            >
              <IconButton
                size="small"
                aria-label={`View details for ${checkpoint.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onViewDetails();
                }}
              >
                <InfoOutlinedIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                aria-label="Edit checkpoint"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
        </Popup>
      )}
    </>
  );
}
