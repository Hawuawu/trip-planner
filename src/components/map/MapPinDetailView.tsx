import { Box, Stack, Typography, Link, Button } from '@mui/material';
import EditIcon from '@mui/icons-material/EditOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { CheckpointIcon } from '../timeline/CheckpointIcon';
import { LocationLinks } from '../shared/LocationLinks';
import { MarkdownNotes } from '../shared/MarkdownNotes';
import { isHttpUrl } from '../../utils/url';
import type { CheckpointType, Location } from '../../types';

interface Props {
  name: string;
  type: CheckpointType;
  location?: Location;
  notes?: string;
  websiteUrl?: string;
  onEdit(): void;
  onClose(): void;
}

export function MapPinDetailView({
  name,
  type,
  location,
  notes,
  websiteUrl,
  onEdit,
  onClose,
}: Props) {
  const mapsFallbackQuery = location?.label?.trim() || name.trim();

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center" mb={2}>
        <CheckpointIcon type={type} fontSize="small" />
        <Typography variant="h6">{name}</Typography>
      </Stack>
      <Stack spacing={2}>
        {location?.label && (
          <Typography variant="body2" color="text.secondary">
            {location.label}
          </Typography>
        )}
        <LocationLinks location={location} mapsFallbackQuery={mapsFallbackQuery} name={name} />
        {websiteUrl?.trim() && isHttpUrl(websiteUrl) && (
          <Link
            href={websiteUrl.trim()}
            target="_blank"
            rel="noopener noreferrer"
            variant="body2"
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
          >
            <OpenInNewIcon fontSize="small" /> Visit website
          </Link>
        )}
        {notes ? (
          <MarkdownNotes notes={notes} variant="body2" />
        ) : (
          <Typography variant="body2" color="text.secondary">
            No notes.
          </Typography>
        )}
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button onClick={onClose} size="small">
            Close
          </Button>
          <Button
            onClick={onEdit}
            variant="contained"
            size="small"
            startIcon={<EditIcon fontSize="small" />}
          >
            Edit
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
