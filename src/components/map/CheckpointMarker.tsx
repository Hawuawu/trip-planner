import { useState } from 'react';
import { Marker, Popup } from 'react-map-gl/maplibre';
import { Box, IconButton } from '@mui/material';
import EditIcon from '@mui/icons-material/EditOutlined';
import { CheckpointIcon } from '../timeline/CheckpointIcon';
import type { Checkpoint } from '../../types';

interface Props {
  checkpoint: Checkpoint;
  isSelected: boolean;
  onSelect(): void;
  onEdit(): void;
}

export function CheckpointMarker({ checkpoint, isSelected, onSelect, onEdit }: Props) {
  const [showPopup, setShowPopup] = useState(false);
  if (!checkpoint.location) return null;

  const color = isSelected ? '#e94560' : '#1a1a2e';

  return (
    <>
      <Marker
        longitude={checkpoint.location.lng}
        latitude={checkpoint.location.lat}
        anchor="center"
        onClick={(e) => {
          e.originalEvent.stopPropagation();
          onSelect();
          setShowPopup(true);
        }}
      >
        <div
          style={{
            background: isSelected ? '#e94560' : '#fff',
            border: `2px solid ${color}`,
            borderRadius: '50%',
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isSelected ? '#fff' : color,
            cursor: 'pointer',
          }}
        >
          <CheckpointIcon type={checkpoint.type} style={{ width: 20, height: 20 }} />
        </div>
      </Marker>

      {showPopup && (
        <Popup
          longitude={checkpoint.location.lng}
          latitude={checkpoint.location.lat}
          anchor="bottom"
          onClose={() => setShowPopup(false)}
          closeOnClick={false}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 1,
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <strong>{checkpoint.name}</strong>
              {checkpoint.location.label && (
                <>
                  <br />
                  {checkpoint.location.label}
                </>
              )}
            </Box>
            <IconButton
              size="small"
              aria-label="Edit checkpoint"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              sx={{ mt: -0.5, mr: -0.5 }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Box>
        </Popup>
      )}
    </>
  );
}
