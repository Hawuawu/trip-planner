import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  IconButton,
  Stack,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
  AppBar,
  Toolbar,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import LogoutIcon from '@mui/icons-material/Logout';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import type { TripRepository } from '../../data/TripRepository';
import type { Trip, Checkpoint, Alternative } from '../../types';
import { useAuthStore } from '../../store/authStore';
import emptyStateBanner from '../../assets/empty-state-banner.svg';
import { serializeTrip, parseTripYaml, type ParsedTripYaml } from '../../data/tripYaml';
import { downloadTextFile, slugifyFilename } from '../../utils/fileTransfer';
import { YamlImportDialog } from './YamlImportDialog';

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

function canManage(trip: Trip, uid: string | undefined): boolean {
  return !trip.ownerId || trip.ownerId === uid;
}

// One-shot fetch of a trip's checkpoints/alternatives — there's no dedicated
// repo method for this, so we subscribe, wait for the first callback from
// each, then unsubscribe. Some repos (e.g. LocalTripRepository) invoke the
// subscribe callback synchronously before returning the unsubscribe
// function, so the actual unsubscribe calls are deferred to a microtask to
// avoid referencing an unsub function before it has been assigned.
function fetchTripDataOnce(
  repo: TripRepository,
  tripId: string
): Promise<{ checkpoints: Checkpoint[]; alternatives: Alternative[] }> {
  return new Promise((resolve) => {
    let checkpoints: Checkpoint[] | null = null;
    let alternatives: Alternative[] | null = null;
    let settled = false;

    const unsubCheckpoints = repo.subscribeToCheckpoints(tripId, (cps) => {
      if (checkpoints === null) {
        checkpoints = cps;
        trySettle();
      }
    });
    const unsubAlternatives = repo.subscribeToAlternatives(tripId, (alts) => {
      if (alternatives === null) {
        alternatives = alts;
        trySettle();
      }
    });

    function trySettle() {
      if (settled || checkpoints === null || alternatives === null) return;
      settled = true;
      Promise.resolve().then(() => {
        unsubCheckpoints();
        unsubAlternatives();
      });
      resolve({ checkpoints: checkpoints!, alternatives: alternatives! });
    }
  });
}

export function TripSelectorScreen({ repo, onSelect }: Props) {
  const currentUid = useAuthStore((s) => s.user?.uid);
  const signOut = useAuthStore((s) => s.signOut);
  const service = useAuthStore((s) => s.service);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<FormState>>({});

  const [renameTarget, setRenameTarget] = useState<Trip | null>(null);
  const [renameForm, setRenameForm] = useState<FormState>(EMPTY_FORM);
  const [renameErrors, setRenameErrors] = useState<Partial<FormState>>({});
  const [renameSubmitting, setRenameSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Trip | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const [importDialogOpen, setImportDialogOpen] = useState(false);

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

  function validateForm(state: FormState): Partial<FormState> {
    const next: Partial<FormState> = {};
    if (!state.name.trim()) {
      next.name = 'Name is required';
    }
    if (state.start && state.end && state.end < state.start) {
      next.end = 'End date must be on or after start date';
    }
    return next;
  }

  function validate(): boolean {
    const next = validateForm(form);
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

  function openRenameDialog(trip: Trip) {
    setRenameTarget(trip);
    setRenameForm({ name: trip.name, start: trip.dateRange.start, end: trip.dateRange.end });
    setRenameErrors({});
  }

  function closeRenameDialog() {
    setRenameTarget(null);
  }

  async function handleRenameSubmit() {
    if (!renameTarget) return;
    const next = validateForm(renameForm);
    setRenameErrors(next);
    if (Object.keys(next).length > 0) return;

    setRenameSubmitting(true);
    try {
      const changes = {
        name: renameForm.name.trim(),
        dateRange: { start: renameForm.start, end: renameForm.end },
      };
      await repo.updateTrip(renameTarget.id, changes);
      setTrips((prev) => prev.map((t) => (t.id === renameTarget.id ? { ...t, ...changes } : t)));
      setRenameTarget(null);
    } finally {
      setRenameSubmitting(false);
    }
  }

  function openDeleteDialog(trip: Trip) {
    setDeleteTarget(trip);
  }

  function closeDeleteDialog() {
    setDeleteTarget(null);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);
    try {
      await repo.deleteTrip(deleteTarget.id);
      setTrips((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      setDeleteTarget(null);
    } finally {
      setDeleteSubmitting(false);
    }
  }

  async function handleExportTrip(trip: Trip) {
    const { checkpoints, alternatives } = await fetchTripDataOnce(repo, trip.id);
    const yamlText = serializeTrip(trip, checkpoints, alternatives);
    downloadTextFile(`${slugifyFilename(trip.name, 'trip')}.yaml`, yamlText);
  }

  async function handleImportTripConfirm(parsed: ParsedTripYaml) {
    const newTrip = await repo.createTrip(parsed.name, parsed.dateRange);
    try {
      if (parsed.checkpoints.length > 0) {
        await repo.addCheckpoints(newTrip.id, parsed.checkpoints);
      }
      if (parsed.alternatives.length > 0) {
        await repo.addAlternatives(newTrip.id, parsed.alternatives);
      }
    } catch (e) {
      // Clean up the orphaned empty trip rather than leaving it stranded —
      // the user can retry the import from the same dialog afterwards.
      await repo.deleteTrip(newTrip.id);
      throw e;
    }
    localStorage.setItem('trip-planner:activeTripId', newTrip.id);
    onSelect(newTrip.id);
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {service && (
        <AppBar
          position="static"
          color="default"
          elevation={0}
          sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
        >
          <Toolbar variant="dense" sx={{ justifyContent: 'flex-end' }}>
            <Button
              size="small"
              onClick={signOut}
              title="Sign out"
              startIcon={<LogoutIcon fontSize="small" />}
            >
              Logout
            </Button>
          </Toolbar>
        </AppBar>
      )}

      <Box
        sx={{
          flex: 1,
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
                {trips.map((trip, index) => {
                  const manageable = canManage(trip, currentUid);
                  return (
                    <ListItem
                      key={trip.id}
                      disablePadding
                      divider={index < trips.length - 1}
                      secondaryAction={
                        <Stack direction="row" spacing={0.5}>
                          <IconButton
                            size="small"
                            edge={manageable ? undefined : 'end'}
                            aria-label={`Export ${trip.name}`}
                            onClick={() => handleExportTrip(trip)}
                          >
                            <FileDownloadIcon fontSize="small" />
                          </IconButton>
                          {manageable && (
                            <>
                              <IconButton
                                size="small"
                                aria-label={`Rename ${trip.name}`}
                                onClick={() => openRenameDialog(trip)}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                edge="end"
                                aria-label={`Delete ${trip.name}`}
                                onClick={() => openDeleteDialog(trip)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </>
                          )}
                        </Stack>
                      }
                    >
                      <ListItemButton
                        onClick={() => handleTripClick(trip)}
                        sx={{ py: 1.5, pr: manageable ? 15 : 6 }}
                      >
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
                  );
                })}
              </List>
            )}

            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={openDialog}
                fullWidth
                size="large"
              >
                New trip
              </Button>
              <Button
                variant="outlined"
                startIcon={<UploadFileIcon />}
                onClick={() => setImportDialogOpen(true)}
                fullWidth
                size="large"
              >
                Import trip
              </Button>
            </Stack>
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

        <Dialog open={Boolean(renameTarget)} onClose={closeRenameDialog} fullWidth maxWidth="xs">
          <DialogTitle>Rename trip</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Trip name"
                value={renameForm.name}
                onChange={(e) => setRenameForm((f) => ({ ...f, name: e.target.value }))}
                error={Boolean(renameErrors.name)}
                helperText={renameErrors.name}
                autoFocus
                fullWidth
                inputProps={{ 'aria-label': 'Rename trip name' }}
              />
              <TextField
                label="Start date"
                type="date"
                value={renameForm.start}
                onChange={(e) => setRenameForm((f) => ({ ...f, start: e.target.value }))}
                fullWidth
                InputLabelProps={{ shrink: true }}
                inputProps={{ 'aria-label': 'Rename start date' }}
              />
              <TextField
                label="End date"
                type="date"
                value={renameForm.end}
                onChange={(e) => setRenameForm((f) => ({ ...f, end: e.target.value }))}
                error={Boolean(renameErrors.end)}
                helperText={renameErrors.end}
                fullWidth
                InputLabelProps={{ shrink: true }}
                inputProps={{ 'aria-label': 'Rename end date' }}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeRenameDialog} disabled={renameSubmitting}>
              Cancel
            </Button>
            <Button variant="contained" onClick={handleRenameSubmit} disabled={renameSubmitting}>
              Save
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={Boolean(deleteTarget)} onClose={closeDeleteDialog} fullWidth maxWidth="xs">
          <DialogTitle>Delete trip</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Delete "{deleteTarget?.name}"? This cannot be undone.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDeleteDialog} disabled={deleteSubmitting}>
              Cancel
            </Button>
            <Button color="error" onClick={handleDeleteConfirm} disabled={deleteSubmitting}>
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        <YamlImportDialog
          open={importDialogOpen}
          title="Import trip"
          description="Import a trip exported from this app (or any file with matching name/dateRange/checkpoints/alternatives) as a new trip."
          onClose={() => setImportDialogOpen(false)}
          parse={parseTripYaml}
          onConfirm={handleImportTripConfirm}
        />
      </Box>
    </Box>
  );
}
