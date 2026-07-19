import { useState } from 'react';
import { Box, TextField, MenuItem, Button, Stack, Typography } from '@mui/material';
import type { Alternative, CheckpointType } from '../../types';

const TYPES: { value: CheckpointType; label: string }[] = [
  { value: 'flight', label: 'Flight' },
  { value: 'train', label: 'Train' },
  { value: 'metro', label: 'Metro' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'poi', label: 'Point of Interest' },
  { value: 'other', label: 'Other' },
];

type FormData = Omit<Alternative, 'id'>;

interface Props {
  initial?: Partial<FormData>;
  onSave(data: FormData): void;
  onCancel(): void;
  title?: string;
}

export function AlternativeForm({ initial, onSave, onCancel, title }: Props) {
  const [type, setType] = useState<CheckpointType>(initial?.type ?? 'poi');
  const [name, setName] = useState(initial?.name ?? '');
  const [locLabel, setLocLabel] = useState(initial?.location?.label ?? '');
  const [locLat, setLocLat] = useState(initial?.location ? String(initial.location.lat) : '');
  const [locLng, setLocLng] = useState(initial?.location ? String(initial.location.lng) : '');
  const [notes, setNotes] = useState(initial?.notes ?? '');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const lat = parseFloat(locLat);
    const lng = parseFloat(locLng);
    const location =
      locLat && locLng && !isNaN(lat) && !isNaN(lng)
        ? { lat, lng, label: locLabel || undefined }
        : undefined;
    onSave({
      type,
      name: name.trim(),
      location,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ p: 2 }}>
      {title && (
        <Typography variant="h6" mb={2}>
          {title}
        </Typography>
      )}
      <Stack spacing={2}>
        <TextField
          select
          label="Type"
          value={type}
          onChange={(e) => setType(e.target.value as CheckpointType)}
          size="small"
          fullWidth
        >
          {TYPES.map((t) => (
            <MenuItem key={t.value} value={t.value}>
              {t.label}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          size="small"
          fullWidth
          autoFocus
          inputProps={{ 'aria-label': 'Name' }}
        />

        <TextField
          label="Location label"
          value={locLabel}
          onChange={(e) => setLocLabel(e.target.value)}
          size="small"
          fullWidth
          placeholder="e.g. Shinjuku, Tokyo"
        />

        <Stack direction="row" spacing={1}>
          <TextField
            label="Lat"
            value={locLat}
            onChange={(e) => setLocLat(e.target.value)}
            size="small"
            type="number"
            inputProps={{ step: 'any' }}
          />
          <TextField
            label="Lng"
            value={locLng}
            onChange={(e) => setLocLng(e.target.value)}
            size="small"
            type="number"
            inputProps={{ step: 'any' }}
          />
        </Stack>

        <TextField
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          size="small"
          fullWidth
          multiline
          rows={2}
        />

        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button onClick={onCancel} size="small">
            Cancel
          </Button>
          <Button type="submit" variant="contained" size="small">
            Save
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
