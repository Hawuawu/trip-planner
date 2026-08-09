import { useState } from 'react';
import { Marker, Popup } from 'react-map-gl/maplibre';
import { Box, Button } from '@mui/material';
import EditIcon from '@mui/icons-material/EditOutlined';
import { CheckpointIcon } from '../timeline/CheckpointIcon';
import type { Alternative } from '../../types';

// Wisteria Purple — distinguishes the alternatives layer as a whole from
// checkpoint markers; not per-category (type is still shown via icon).
const ALTERNATIVE_MARKER_COLOR = '#9B59B6';

interface Props {
  alternative: Alternative;
  onEdit(): void;
}

export function AlternativeMarker({ alternative, onEdit }: Props) {
  const [showPopup, setShowPopup] = useState(false);
  if (!alternative.location) return null;

  return (
    <>
      <Marker
        longitude={alternative.location.lng}
        latitude={alternative.location.lat}
        anchor="center"
        onClick={(e) => {
          e.originalEvent.stopPropagation();
          setShowPopup(true);
        }}
      >
        <div
          style={{
            background: '#fff',
            border: `2px solid ${ALTERNATIVE_MARKER_COLOR}`,
            borderRadius: '50%',
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: ALTERNATIVE_MARKER_COLOR,
            cursor: 'pointer',
          }}
        >
          <CheckpointIcon type={alternative.type} style={{ width: 20, height: 20 }} />
        </div>
      </Marker>

      {showPopup && (
        <Popup
          longitude={alternative.location.lng}
          latitude={alternative.location.lat}
          anchor="bottom"
          onClose={() => setShowPopup(false)}
          closeOnClick={false}
        >
          <Box sx={{ minWidth: 0 }}>
            <Box>
              <strong>{alternative.name}</strong>
              {alternative.location.label && (
                <>
                  <br />
                  {alternative.location.label}
                </>
              )}
            </Box>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                mt: 0.5,
                pt: 0.5,
                borderTop: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Button
                size="small"
                variant="outlined"
                aria-label="Edit alternative"
                startIcon={<EditIcon fontSize="small" />}
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
              >
                Edit
              </Button>
            </Box>
          </Box>
        </Popup>
      )}
    </>
  );
}
