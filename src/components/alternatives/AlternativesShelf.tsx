import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  DialogActions,
  Drawer,
  InputAdornment,
  Snackbar,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import SearchIcon from '@mui/icons-material/Search';
import { useTripStore } from '../../store/tripStore';
import { AlternativeItem } from './AlternativeItem';
import { AlternativeForm } from './AlternativeForm';

interface Props {
  openAddSignal?: number;
}

export function AlternativesShelf({ openAddSignal }: Props) {
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'));

  const {
    alternatives,
    addAlternative,
    updateAlternative,
    deleteAlternative,
    promoteAlternative,
    undoAlternative,
    undoDeleteAlternative,
    clearUndoAlternative,
  } = useTripStore();

  const [search, setSearch] = useState('');
  const [promoteId, setPromoteId] = useState<string | null>(null);
  const [promoteTime, setPromoteTime] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const promoting = alternatives.find((a) => a.id === promoteId);
  const editing = editingId ? alternatives.find((a) => a.id === editingId) : null;

  useEffect(() => {
    if (openAddSignal === undefined) return;
    setAddOpen(true);
  }, [openAddSignal]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return alternatives;
    return alternatives.filter((a) =>
      [a.name, a.location?.label, a.notes].some((f) => f?.toLowerCase().includes(q))
    );
  }, [alternatives, search]);

  function handlePromote() {
    if (!promoteId || !promoteTime) return;
    promoteAlternative(promoteId, new Date(promoteTime).toISOString());
    setPromoteId(null);
    setPromoteTime('');
  }

  const drawerContent = addOpen ? (
    <AlternativeForm
      title="Add alternative"
      onSave={(data) => {
        addAlternative(data);
        setAddOpen(false);
      }}
      onCancel={() => setAddOpen(false)}
    />
  ) : editing ? (
    <AlternativeForm
      title="Edit alternative"
      initial={editing}
      onSave={(data) => {
        updateAlternative(editing.id, data);
        setEditingId(null);
      }}
      onCancel={() => setEditingId(null)}
    />
  ) : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      {alternatives.length === 0 ? (
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            px: 2,
            color: 'text.secondary',
          }}
        >
          <Typography variant="h6">No alternatives yet</Typography>
          <Button
            variant="contained"
            startIcon={<AddCircleOutlineIcon />}
            onClick={() => setAddOpen(true)}
          >
            Add alternative
          </Button>
        </Box>
      ) : (
        <>
          <Box sx={{ p: 2, pb: 1 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Search alternatives…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          <Box sx={{ px: 2, pb: 2, flex: 1 }}>
            {filtered.length === 0 ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 2, textAlign: 'center' }}
              >
                No alternatives match "{search}".
              </Typography>
            ) : (
              filtered.map((alt) => (
                <AlternativeItem
                  key={alt.id}
                  alternative={alt}
                  onSelect={() => setEditingId(alt.id)}
                  onPromote={() => setPromoteId(alt.id)}
                  onDelete={() => deleteAlternative(alt.id)}
                />
              ))
            )}
          </Box>
        </>
      )}

      <Drawer
        anchor={isPhone ? 'bottom' : 'right'}
        open={!!(addOpen || editing)}
        onClose={() => {
          setAddOpen(false);
          setEditingId(null);
        }}
        PaperProps={{
          sx: {
            width: isPhone ? '100%' : 380,
            borderTopLeftRadius: isPhone ? 12 : 0,
            borderTopRightRadius: isPhone ? 12 : 0,
            maxHeight: isPhone ? '85vh' : '100vh',
          },
        }}
      >
        {drawerContent}
      </Drawer>

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

      <Snackbar
        open={!!undoAlternative}
        message={`Deleted "${undoAlternative?.name}"`}
        autoHideDuration={4000}
        onClose={clearUndoAlternative}
        action={
          <Button color="secondary" size="small" onClick={undoDeleteAlternative}>
            UNDO
          </Button>
        }
      />
    </Box>
  );
}
