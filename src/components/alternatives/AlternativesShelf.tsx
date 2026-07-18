import { useState } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  DialogActions,
  MenuItem,
  Stack,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import { useTripStore } from '../../store/tripStore';
import { CheckpointIcon } from '../timeline/CheckpointIcon';
import type { CheckpointType } from '../../types';

const TYPES: { value: CheckpointType; label: string }[] = [
  { value: 'flight', label: 'Flight' },
  { value: 'train', label: 'Train' },
  { value: 'metro', label: 'Metro' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'poi', label: 'Point of Interest' },
  { value: 'other', label: 'Other' },
];

interface AddFormState {
  type: CheckpointType;
  name: string;
  locLabel: string;
  locLat: string;
  locLng: string;
  notes: string;
}

const EMPTY_FORM: AddFormState = {
  type: 'poi',
  name: '',
  locLabel: '',
  locLat: '',
  locLng: '',
  notes: '',
};

export function AlternativesShelf() {
  const { alternatives, addAlternative, deleteAlternative, promoteAlternative } = useTripStore();
  const [promoteId, setPromoteId] = useState<string | null>(null);
  const [promoteTime, setPromoteTime] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<AddFormState>(EMPTY_FORM);

  const promoting = alternatives.find((a) => a.id === promoteId);

  function handlePromote() {
    if (!promoteId || !promoteTime) return;
    promoteAlternative(promoteId, new Date(promoteTime).toISOString());
    setPromoteId(null);
    setPromoteTime('');
  }

  function handleAddOpen() {
    setForm(EMPTY_FORM);
    setAddOpen(true);
  }

  function handleAddCancel() {
    setAddOpen(false);
    setForm(EMPTY_FORM);
  }

  function handleAddSubmit() {
    if (!form.name.trim()) return;
    const lat = parseFloat(form.locLat);
    const lng = parseFloat(form.locLng);
    const location =
      form.locLat && form.locLng && !isNaN(lat) && !isNaN(lng)
        ? { lat, lng, label: form.locLabel || undefined }
        : undefined;
    addAlternative({
      type: form.type,
      name: form.name.trim(),
      location,
      notes: form.notes.trim() || undefined,
    });
    setAddOpen(false);
    setForm(EMPTY_FORM);
  }

  return (
    <Box sx={{ p: 2, height: '100%', overflowY: 'auto' }}>
      <Typography variant="h6" gutterBottom>
        Alternatives
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Shortlisted places — not on the timeline yet.
      </Typography>

      <Button
        variant="contained"
        size="small"
        startIcon={<AddCircleOutlineIcon />}
        onClick={handleAddOpen}
        sx={{ mb: 2 }}
      >
        Add alternative
      </Button>

      {alternatives.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No alternatives saved.
        </Typography>
      ) : (
        <List disablePadding>
          {alternatives.map((alt) => (
            <ListItem
              key={alt.id}
              disableGutters
              sx={{
                border: '1.5px dashed',
                borderColor: 'divider',
                borderRadius: 1,
                mb: 1,
                px: 1.5,
                opacity: 0.8,
              }}
              secondaryAction={
                <Box>
                  <IconButton
                    size="small"
                    onClick={() => setPromoteId(alt.id)}
                    title="Add to timeline"
                  >
                    <AddCircleOutlineIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label="Delete alternative"
                    onClick={() => deleteAlternative(alt.id)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              }
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <CheckpointIcon type={alt.type} sx={{ fontSize: 18, color: 'text.secondary' }} />
              </ListItemIcon>
              <ListItemText
                primary={alt.name}
                secondary={alt.location?.label ?? alt.notes}
                primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                secondaryTypographyProps={{ variant: 'caption' }}
              />
            </ListItem>
          ))}
        </List>
      )}

      {/* Add alternative dialog */}
      <Dialog open={addOpen} onClose={handleAddCancel} fullWidth maxWidth="xs">
        <DialogTitle>Add alternative</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="Type"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as CheckpointType }))}
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
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              size="small"
              fullWidth
              required
              autoFocus
              inputProps={{ 'aria-label': 'Name' }}
            />

            <TextField
              label="Location label"
              value={form.locLabel}
              onChange={(e) => setForm((f) => ({ ...f, locLabel: e.target.value }))}
              size="small"
              fullWidth
              placeholder="e.g. Shinjuku, Tokyo"
            />

            <Stack direction="row" spacing={1}>
              <TextField
                label="Lat"
                value={form.locLat}
                onChange={(e) => setForm((f) => ({ ...f, locLat: e.target.value }))}
                size="small"
                type="number"
                inputProps={{ step: 'any' }}
              />
              <TextField
                label="Lng"
                value={form.locLng}
                onChange={(e) => setForm((f) => ({ ...f, locLng: e.target.value }))}
                size="small"
                type="number"
                inputProps={{ step: 'any' }}
              />
            </Stack>

            <TextField
              label="Notes"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              size="small"
              fullWidth
              multiline
              rows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleAddCancel}>Cancel</Button>
          <Button onClick={handleAddSubmit} variant="contained" disabled={!form.name.trim()}>
            Add
          </Button>
        </DialogActions>
      </Dialog>

      {/* Promote dialog */}
      <Dialog open={!!promoteId} onClose={() => setPromoteId(null)}>
        <DialogTitle>Add "{promoting?.name}" to timeline</DialogTitle>
        <DialogContent>
          <TextField
            label="Start time"
            type="datetime-local"
            value={promoteTime}
            onChange={(e) => setPromoteTime(e.target.value)}
            fullWidth
            size="small"
            InputLabelProps={{ shrink: true }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPromoteId(null)}>Cancel</Button>
          <Button onClick={handlePromote} variant="contained" disabled={!promoteTime}>
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
