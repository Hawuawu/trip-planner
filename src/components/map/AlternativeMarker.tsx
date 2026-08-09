import { useState } from 'react';
import { Marker, Popup } from 'react-map-gl/maplibre';
import { Box, IconButton } from '@mui/material';
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
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 1,
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <strong>{alternative.name}</strong>
              {alternative.location.label && (
                <>
                  <br />
                  {alternative.location.label}
                </>
              )}
            </Box>
            <IconButton
              size="small"
              aria-label="Edit alternative"
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
