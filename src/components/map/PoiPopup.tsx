import { useState } from 'react';
import { Popup } from 'react-map-gl/maplibre';
import { Box, IconButton, Typography } from '@mui/material';
import BookmarkAddIcon from '@mui/icons-material/BookmarkAddOutlined';
import TranslateIcon from '@mui/icons-material/TranslateOutlined';
import { hasKanji } from '../../utils/kanjiReading';
import { useRomanizeIntoField, romanizeStatusMessage } from '../../hooks/useRomanizeIntoField';
import type { Poi } from './poi';

interface Props {
  poi: Poi;
  onAddAsAlternative(name: string): void;
  onClose(): void;
}

export function PoiPopup({ poi, onAddAsAlternative, onClose }: Props) {
  const [name, setName] = useState(poi.name);
  const { status, romanize } = useRomanizeIntoField(setName);

  return (
    <Popup
      longitude={poi.location.lng}
      latitude={poi.location.lat}
      anchor="bottom"
      onClose={onClose}
      closeOnClick={false}
    >
      <Box sx={{ minWidth: 0 }}>
        <Box>
          <strong>{name}</strong>
        </Box>
        {romanizeStatusMessage(status) && (
          <Typography variant="caption" color="text.secondary" component="p">
            {romanizeStatusMessage(status)}
          </Typography>
        )}
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
          {hasKanji(name) && status !== 'done' && (
            <IconButton
              size="small"
              aria-label="Insert romaji reading"
              disabled={status === 'loading'}
              onClick={(e) => {
                e.stopPropagation();
                romanize(name);
              }}
            >
              <TranslateIcon fontSize="small" />
            </IconButton>
          )}
          <IconButton
            size="small"
            aria-label={`Add ${name} as alternative`}
            onClick={(e) => {
              e.stopPropagation();
              onAddAsAlternative(name);
            }}
          >
            <BookmarkAddIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
    </Popup>
  );
}
