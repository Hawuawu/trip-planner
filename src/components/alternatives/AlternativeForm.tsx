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
import type { Alternative, CheckpointType } from '../../types';
import { getTagColor } from '../../utils/tagColors';
import { hasKanji } from '../../utils/kanjiReading';
import { useRomanizeIntoField, romanizeStatusMessage } from '../../hooks/useRomanizeIntoField';
import { isHttpUrl } from '../../utils/url';
import { MarkdownNotesField } from '../shared/MarkdownNotesField';
import { LocationLinks } from '../shared/LocationLinks';

const TYPES: { value: CheckpointType; label: string }[] = [
  { value: 'flight', label: 'Flight' },
  { value: 'train', label: 'Train' },
  { value: 'metro', label: 'Metro' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'poi', label: 'Point of Interest' },
  { value: 'other', label: 'Other' },
];

type FormData = Omit<Alternative, 'id' | 'createdAt'>;

interface Props {
  initial?: Partial<FormData>;
  existingTags?: string[];
  onSave(data: FormData): void;
  onCancel(): void;
  title?: string;
}

export function AlternativeForm({ initial, existingTags, onSave, onCancel, title }: Props) {
  const [type, setType] = useState<CheckpointType>(initial?.type ?? 'poi');
  const [name, setName] = useState(initial?.name ?? '');
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
    if (!name.trim()) return;
    const pendingTag = tagInput.trim();
    const allTags = pendingTag ? [...tags, pendingTag] : tags;
    const cleanedTags = Array.from(new Set(allTags.map((t) => t.trim()).filter(Boolean)));
    onSave({
      type,
      name: name.trim(),
      location,
      notes: notes.trim() || undefined,
      websiteUrl: websiteUrl.trim() || undefined,
      tags: cleanedTags.length > 0 ? cleanedTags : undefined,
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
          inputProps={{ 'aria-label': 'Name' }}
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
    </Box>
  );
}
