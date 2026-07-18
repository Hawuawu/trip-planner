import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Button,
  TextField,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import type { TripRepository } from '../../data/TripRepository';
import type { Trip } from '../../types';
import emptyStateBanner from '../../assets/empty-state-banner.svg';

interface Props {
  repo: TripRepository;
  onSelect: (tripId: string) => void;
}

interface FormState {
  name: string;
  start: string;
  end: string;
}

const EMPTY_FORM: FormState = { name: '', start: '', end: '' };

export function TripSelectorScreen({ repo, onSelect }: Props) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<FormState>>({});

  useEffect(() => {
    let cancelled = false;
    repo.listTrips().then((result) => {
      if (!cancelled) {
        setTrips(result);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [repo]);

  function handleTripClick(trip: Trip) {
    localStorage.setItem('trip-planner:activeTripId', trip.id);
    onSelect(trip.id);
  }

  function openDialog() {
    setForm(EMPTY_FORM);
    setErrors({});
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
  }

  function validate(): boolean {
    const next: Partial<FormState> = {};
    if (!form.name.trim()) {
      next.name = 'Name is required';
    }
    if (form.start && form.end && form.end < form.start) {
      next.end = 'End date must be on or after start date';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const newTrip = await repo.createTrip(form.name.trim(), {
        start: form.start,
        end: form.end,
      });
      localStorage.setItem('trip-planner:activeTripId', newTrip.id);
      setDialogOpen(false);
      onSelect(newTrip.id);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        pt: { xs: 6, sm: 10 },
        px: 2,
      }}
    >
      <Typography variant="h5" fontWeight={700} mb={1}>
        Your trips
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={4}>
        Select a trip to continue or create a new one.
      </Typography>

      {loading ? (
        <CircularProgress size={32} />
      ) : (
        <Box sx={{ width: '100%', maxWidth: 480 }}>
          {trips.length === 0 ? (
            <Box textAlign="center" py={2}>
              <Box
                component="img"
                src={emptyStateBanner}
                alt=""
                sx={{ width: '100%', maxWidth: 280, mb: 2 }}
              />
              <Typography color="text.secondary" textAlign="center" py={2}>
                No trips yet. Create your first trip below.
              </Typography>
            </Box>
          ) : (
            <List
              disablePadding
              sx={{
                bgcolor: 'background.paper',
                borderRadius: 2,
                mb: 3,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              {trips.map((trip, index) => (
                <ListItem key={trip.id} disablePadding divider={index < trips.length - 1}>
                  <ListItemButton onClick={() => handleTripClick(trip)} sx={{ py: 1.5 }}>
                    <ListItemText
                      primary={trip.name}
                      secondary={
                        trip.dateRange.start && trip.dateRange.end
                          ? `${trip.dateRange.start} – ${trip.dateRange.end}`
                          : undefined
                      }
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openDialog}
            fullWidth
            size="large"
          >
            New trip
          </Button>
        </Box>
      )}

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="xs">
        <DialogTitle>Create a new trip</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Trip name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              error={Boolean(errors.name)}
              helperText={errors.name}
              autoFocus
              fullWidth
              inputProps={{ 'aria-label': 'Trip name' }}
            />
            <TextField
              label="Start date"
              type="date"
              value={form.start}
              onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))}
              fullWidth
              InputLabelProps={{ shrink: true }}
              inputProps={{ 'aria-label': 'Start date' }}
            />
            <TextField
              label="End date"
              type="date"
              value={form.end}
              onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))}
              error={Boolean(errors.end)}
              helperText={errors.end}
              fullWidth
              InputLabelProps={{ shrink: true }}
              inputProps={{ 'aria-label': 'End date' }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSubmit} disabled={submitting}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
