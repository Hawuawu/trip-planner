import { useState } from 'react';
import {
  Box, TextField, MenuItem, Button, Stack, Typography,
} from '@mui/material';
import type { Checkpoint, CheckpointType } from '../../types';
import { BookingPanel } from './BookingPanel';

const TYPES: { value: CheckpointType; label: string }[] = [
  { value: 'flight', label: 'Flight' },
  { value: 'train',  label: 'Train' },
  { value: 'metro',  label: 'Metro' },
  { value: 'hotel',  label: 'Hotel' },
  { value: 'poi',    label: 'Point of Interest' },
  { value: 'other',  label: 'Other' },
];

type FormData = Omit<Checkpoint, 'id' | 'updatedAt'>;

interface Props {
  initial?: Partial<FormData> & { id?: string };
  defaultStartTime?: string;
  onSave(data: FormData): void;
  onCancel(): void;
  title?: string;
}

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(s: string): string {
  return new Date(s).toISOString();
}

export function CheckpointForm({ initial, defaultStartTime, onSave, onCancel, title }: Props) {
  const [type, setType] = useState<CheckpointType>(initial?.type ?? 'poi');
  const [name, setName] = useState(initial?.name ?? '');
  const [startTime, setStartTime] = useState(
    initial?.startTime ? toDatetimeLocal(initial.startTime) : (defaultStartTime ? toDatetimeLocal(defaultStartTime) : '')
  );
  const [endTime, setEndTime] = useState(initial?.endTime ? toDatetimeLocal(initial.endTime) : '');
  const [locLabel, setLocLabel] = useState(initial?.location?.label ?? '');
  const [locLat, setLocLat] = useState(initial?.location ? String(initial.location.lat) : '');
  const [locLng, setLocLng] = useState(initial?.location ? String(initial.location.lng) : '');
  const [notes, setNotes] = useState(initial?.notes ?? '');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !startTime) return;
    const lat = parseFloat(locLat);
    const lng = parseFloat(locLng);
    const location = locLat && locLng && !isNaN(lat) && !isNaN(lng)
      ? { lat, lng, label: locLabel || undefined }
      : undefined;
    onSave({
      type,
      name: name.trim(),
      startTime: fromDatetimeLocal(startTime),
      endTime: endTime ? fromDatetimeLocal(endTime) : undefined,
      location,
      notes: notes.trim() || undefined,
      linkedBookingId: initial?.linkedBookingId,
    });
  }

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ p: 2 }}>
      {title && <Typography variant="h6" mb={2}>{title}</Typography>}
      <Stack spacing={2}>
        <TextField
          select
          label="Type"
          value={type}
          onChange={e => setType(e.target.value as CheckpointType)}
          size="small"
          fullWidth
        >
          {TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
        </TextField>

        <TextField
          label="Name"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          size="small"
          fullWidth
          autoFocus
        />

        <TextField
          label="Start time"
          type="datetime-local"
          value={startTime}
          onChange={e => setStartTime(e.target.value)}
          required
          size="small"
          fullWidth
          InputLabelProps={{ shrink: true }}
        />

        <TextField
          label="End time (optional)"
          type="datetime-local"
          value={endTime}
          onChange={e => setEndTime(e.target.value)}
          size="small"
          fullWidth
          InputLabelProps={{ shrink: true }}
        />

        <TextField
          label="Location label"
          value={locLabel}
          onChange={e => setLocLabel(e.target.value)}
          size="small"
          fullWidth
          placeholder="e.g. Shinjuku, Tokyo"
        />

        <Stack direction="row" spacing={1}>
          <TextField
            label="Lat"
            value={locLat}
            onChange={e => setLocLat(e.target.value)}
            size="small"
            type="number"
            inputProps={{ step: 'any' }}
          />
          <TextField
            label="Lng"
            value={locLng}
            onChange={e => setLocLng(e.target.value)}
            size="small"
            type="number"
            inputProps={{ step: 'any' }}
          />
        </Stack>

        <TextField
          label="Notes"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          size="small"
          fullWidth
          multiline
          rows={2}
        />

        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button onClick={onCancel} size="small">Cancel</Button>
          <Button type="submit" variant="contained" size="small">Save</Button>
        </Stack>
      </Stack>

      {initial?.id && (
        <BookingPanel
          checkpointId={initial.id}
          linkedBookingId={initial.linkedBookingId}
        />
      )}
    </Box>
  );
}
