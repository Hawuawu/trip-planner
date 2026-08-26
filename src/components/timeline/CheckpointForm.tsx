import { useState } from 'react';
import {
  Box,
  TextField,
  MenuItem,
  Button,
  Stack,
  Typography,
  IconButton,
  InputAdornment,
  Link,
  Autocomplete,
  Chip,
} from '@mui/material';
import TranslateIcon from '@mui/icons-material/TranslateOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import type { Checkpoint, CheckpointType } from '../../types';
import { BookingPanel } from './BookingPanel';
import { getTagColor } from '../../utils/tagColors';
import { hasKanji } from '../../utils/kanjiReading';
import { useRomanizeIntoField, romanizeStatusMessage } from '../../hooks/useRomanizeIntoField';
import { isHttpUrl } from '../../utils/url';
import { MarkdownNotesField } from '../shared/MarkdownNotesField';
import { LocationLinks } from '../shared/LocationLinks';
import { pad, parseOffsetDateTime, extractOffset, currentUtcOffsetString } from '../../utils/date';

const TYPES: { value: CheckpointType; label: string }[] = [
  { value: 'flight', label: 'Flight' },
  { value: 'train', label: 'Train' },
  { value: 'metro', label: 'Metro' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'poi', label: 'Point of Interest' },
  { value: 'other', label: 'Other' },
];

type FormData = Omit<Checkpoint, 'id' | 'updatedAt'>;

interface Props {
  initial?: Partial<FormData> & { id?: string };
  defaultStartTime?: string;
  existingTags?: string[];
  onSave(data: FormData): void;
  onCancel(): void;
  title?: string;
}

// The datetime-local input only carries wall-clock digits, no offset — the
// offset is tracked separately in state (see startOffset/endOffset below)
// and reattached on save, so it round-trips losslessly through an edit.
function toDatetimeLocal(iso: string): string {
  const { year, month, day, hour, minute } = parseOffsetDateTime(iso);
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
}

function fromDatetimeLocal(value: string, offset: string): string {
  return `${value}:00${offset}`;
}

export function CheckpointForm({
  initial,
  defaultStartTime,
  existingTags,
  onSave,
  onCancel,
  title,
}: Props) {
  const [type, setType] = useState<CheckpointType>(initial?.type ?? 'poi');
  const [name, setName] = useState(initial?.name ?? '');
  const [startTime, setStartTime] = useState(
    initial?.startTime
      ? toDatetimeLocal(initial.startTime)
      : defaultStartTime
        ? toDatetimeLocal(defaultStartTime)
        : ''
  );
  const [endTime, setEndTime] = useState(initial?.endTime ? toDatetimeLocal(initial.endTime) : '');
  // A flight's start/end legs can legitimately carry different UTC offsets
  // (e.g. departs Prague +02:00, lands Istanbul +03:00) — tracked
  // independently so editing one field never clobbers the other's offset.
  const [startOffset] = useState(() =>
    initial?.startTime
      ? extractOffset(initial.startTime)
      : defaultStartTime
        ? extractOffset(defaultStartTime)
        : currentUtcOffsetString()
  );
  const [endOffset] = useState(() =>
    initial?.endTime ? extractOffset(initial.endTime) : startOffset
  );
  const [locLabel, setLocLabel] = useState(initial?.location?.label ?? '');
  const [locLat, setLocLat] = useState(initial?.location ? String(initial.location.lat) : '');
  const [locLng, setLocLng] = useState(initial?.location ? String(initial.location.lng) : '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [websiteUrl, setWebsiteUrl] = useState(initial?.websiteUrl ?? '');
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  // Tracks whatever's currently typed in the free-solo tags input but not
  // yet committed to a chip (via Enter/selection) — without this, clicking
  // Save right after typing a tag (a very natural flow) silently drops it,
  // since `tags` only gets updated on commit, not on every keystroke.
  const [tagInput, setTagInput] = useState('');
  const {
    status: nameRomanizeStatus,
    romanize: romanizeName,
    resetStatus: resetNameRomanizeStatus,
  } = useRomanizeIntoField(setName);

  const lat = parseFloat(locLat);
  const lng = parseFloat(locLng);
  const location =
    locLat && locLng && !isNaN(lat) && !isNaN(lng)
      ? { lat, lng, label: locLabel || undefined }
      : undefined;
  const mapsFallbackQuery = locLabel.trim() || name.trim();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !startTime) return;
    const pendingTag = tagInput.trim();
    const allTags = pendingTag ? [...tags, pendingTag] : tags;
    const cleanedTags = Array.from(new Set(allTags.map((t) => t.trim()).filter(Boolean)));
    onSave({
      type,
      name: name.trim(),
      startTime: fromDatetimeLocal(startTime, startOffset),
      endTime: endTime ? fromDatetimeLocal(endTime, endOffset) : undefined,
      location,
      notes: notes.trim() || undefined,
      websiteUrl: websiteUrl.trim() || undefined,
      tags: cleanedTags.length > 0 ? cleanedTags : undefined,
      linkedBookingId: initial?.linkedBookingId,
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
          onChange={(e) => {
            setName(e.target.value);
            resetNameRomanizeStatus();
          }}
          required
          size="small"
          fullWidth
          autoFocus
          helperText={romanizeStatusMessage(nameRomanizeStatus)}
          InputProps={{
            endAdornment: hasKanji(name) && nameRomanizeStatus !== 'done' && (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  aria-label="Insert romaji reading"
                  disabled={nameRomanizeStatus === 'loading'}
                  onClick={() => romanizeName(name)}
                >
                  <TranslateIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <TextField
          label="Start time"
          type="datetime-local"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          required
          size="small"
          fullWidth
          InputLabelProps={{ shrink: true }}
        />

        <TextField
          label="End time (optional)"
          type="datetime-local"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          size="small"
          fullWidth
          InputLabelProps={{ shrink: true }}
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

        <LocationLinks location={location} mapsFallbackQuery={mapsFallbackQuery} name={name} />

        <Box>
          <TextField
            label="Website"
            type="url"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            size="small"
            fullWidth
          />
          {websiteUrl.trim() &&
            (isHttpUrl(websiteUrl) ? (
              <Link
                href={websiteUrl.trim()}
                target="_blank"
                rel="noopener noreferrer"
                variant="body2"
                sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}
              >
                <OpenInNewIcon fontSize="small" /> Visit website
              </Link>
            ) : (
              <Typography variant="caption" color="text.secondary" component="p" mt={0.5}>
                Won't be clickable until it starts with http:// or https://
              </Typography>
            ))}
        </Box>

        <MarkdownNotesField label="Notes" value={notes} onChange={setNotes} />

        <Autocomplete
          multiple
          freeSolo
          size="small"
          options={existingTags ?? []}
          value={tags}
          inputValue={tagInput}
          onChange={(_e, newValue) => setTags(newValue)}
          onInputChange={(_e, newInputValue) => setTagInput(newInputValue)}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => {
              const color = getTagColor(option);
              return (
                <Chip
                  size="small"
                  label={option}
                  sx={{
                    bgcolor: color.bg,
                    color: color.fg,
                    '& .MuiChip-deleteIcon': { color: color.fg, opacity: 0.7 },
                  }}
                  {...getTagProps({ index })}
                />
              );
            })
          }
          renderInput={(params) => <TextField {...params} label="Tags" placeholder="Add tag…" />}
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

      {initial?.id && (
        <BookingPanel checkpointId={initial.id} linkedBookingId={initial.linkedBookingId} />
      )}
    </Box>
  );
}
