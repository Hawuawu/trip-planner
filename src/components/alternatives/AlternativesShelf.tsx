import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  MenuItem,
  DialogActions,
  Snackbar,
  CircularProgress,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import { useTripStore } from '../../store/tripStore';
import { AlternativeItem } from './AlternativeItem';
import { AlternativeForm } from './AlternativeForm';
import { ListControls } from '../shared/ListControls';
import { ResponsiveEditDrawer } from '../shared/ResponsiveEditDrawer';
import { collectAllTags } from '../../utils/tags';
import { filterAlternatives } from '../../utils/alternativesFilter';
import type { Alternative } from '../../types';

interface Props {
  openAddSignal?: number;
  prefill?: Partial<Omit<Alternative, 'id' | 'createdAt'>> | null;
  onSaved?: (message: string) => void;
  onError?: (message: string) => void;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

type SortBy = 'name' | 'date';
type SortDir = 'asc' | 'desc';
type SortOption = 'name-asc' | 'name-desc' | 'date-desc' | 'date-asc';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'date-desc', label: 'Date added (Newest first)' },
  { value: 'date-asc', label: 'Date added (Oldest first)' },
  { value: 'name-asc', label: 'Name (A–Z)' },
  { value: 'name-desc', label: 'Name (Z–A)' },
];

// Missing createdAt (legacy items predating #76) always sorts last, in
// both directions — so it's a distinct branch evaluated before the
// direction flip, not a plain string-compare negation.
function compareAlternatives(
  a: Alternative,
  b: Alternative,
  sortBy: SortBy,
  sortDir: SortDir
): number {
  if (sortBy === 'name') {
    const cmp = a.name.localeCompare(b.name);
    return sortDir === 'asc' ? cmp : -cmp;
  }
  const aHas = a.createdAt !== undefined;
  const bHas = b.createdAt !== undefined;
  if (aHas !== bHas) return aHas ? -1 : 1;
  if (!aHas && !bHas) return 0;
  const cmp = a.createdAt!.localeCompare(b.createdAt!);
  return sortDir === 'asc' ? cmp : -cmp;
}

export function AlternativesShelf({ openAddSignal, prefill, onSaved, onError }: Props) {
  const {
    checkpoints,
    alternatives,
    alternativesLoading,
    addAlternative,
    updateAlternative,
    deleteAlternative,
    promoteAlternative,
    undoAlternative,
    undoDeleteAlternative,
    clearUndoAlternative,
    alternativesSearchFilter: search,
    alternativesTagFilter: selectedTags,
    setAlternativesSearchFilter,
    toggleAlternativesTagFilter,
    selectAlternative,
  } = useTripStore();

  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [promoteId, setPromoteId] = useState<string | null>(null);
  const [promoteTime, setPromoteTime] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [addPrefill, setAddPrefill] = useState<
    Partial<Omit<Alternative, 'id' | 'createdAt'>> | undefined
  >(undefined);
  const [editingId, setEditingId] = useState<string | null>(null);

  const promoting = alternatives.find((a) => a.id === promoteId);
  const editing = editingId ? alternatives.find((a) => a.id === editingId) : null;

  // Read via a ref so a fresh `prefill` value doesn't need to be listed as an
  // effect dependency — only a new openAddSignal should (re)open the drawer.
  const prefillRef = useRef(prefill);
  prefillRef.current = prefill;

  useEffect(() => {
    if (openAddSignal === undefined) return;
    setAddPrefill(prefillRef.current ?? undefined);
    setAddOpen(true);
  }, [openAddSignal]);

  const allTags = useMemo(
    () => collectAllTags(checkpoints, alternatives),
    [checkpoints, alternatives]
  );

  const filtered = useMemo(
    () => filterAlternatives(alternatives, { search, tags: selectedTags }),
    [alternatives, search, selectedTags]
  );

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => compareAlternatives(a, b, sortBy, sortDir)),
    [filtered, sortBy, sortDir]
  );

  function handleSortChange(e: React.ChangeEvent<HTMLInputElement>) {
    const [by, dir] = (e.target.value as SortOption).split('-') as [SortBy, SortDir];
    setSortBy(by);
    setSortDir(dir);
  }

  function handlePromote() {
    if (!promoteId || !promoteTime) return;
    promoteAlternative(promoteId, new Date(promoteTime).toISOString());
    setPromoteId(null);
    setPromoteTime('');
  }

  const drawerContent = addOpen ? (
    <AlternativeForm
      title="Add alternative"
      initial={addPrefill}
      existingTags={allTags}
      onSave={async (data) => {
        try {
          await addAlternative(data);
          setAddOpen(false);
          setAddPrefill(undefined);
          onSaved?.(`Alternative "${data.name}" added.`);
        } catch (err) {
          onError?.(errorMessage(err, `Failed to add "${data.name}".`));
        }
      }}
      onCancel={() => {
        setAddOpen(false);
        setAddPrefill(undefined);
      }}
    />
  ) : editing ? (
    <AlternativeForm
      title="Edit alternative"
      initial={editing}
      existingTags={allTags}
      onSave={async (data) => {
        try {
          await updateAlternative(editing.id, data);
          setEditingId(null);
          onSaved?.(`Alternative "${data.name}" updated.`);
        } catch (err) {
          onError?.(errorMessage(err, `Failed to update "${data.name}".`));
        }
      }}
      onCancel={() => setEditingId(null)}
    />
  ) : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      {alternativesLoading ? (
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CircularProgress size={32} />
        </Box>
      ) : alternatives.length === 0 ? (
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
            onClick={() => {
              setAddPrefill(undefined);
              setAddOpen(true);
            }}
          >
            Add alternative
          </Button>
        </Box>
      ) : (
        <>
          <ListControls
            search={search}
            onSearchChange={setAlternativesSearchFilter}
            searchPlaceholder="Search alternatives…"
            allTags={allTags}
            selectedTags={selectedTags}
            onToggleTag={toggleAlternativesTagFilter}
            extraControls={
              <TextField
                select
                label="Sort by"
                value={`${sortBy}-${sortDir}`}
                onChange={handleSortChange}
                size="small"
                fullWidth
              >
                {SORT_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </TextField>
            }
          />

          <Box sx={{ px: 2, pb: 2, flex: 1 }}>
            {sorted.length === 0 ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 2, textAlign: 'center' }}
              >
                No alternatives match "{search}".
              </Typography>
            ) : (
              sorted.map((alt) => (
                <AlternativeItem
                  key={alt.id}
                  alternative={alt}
                  onSelect={() => selectAlternative(alt.id)}
                  onEdit={() => {
                    selectAlternative(alt.id);
                    setEditingId(alt.id);
                  }}
                  onPromote={() => setPromoteId(alt.id)}
                  onDelete={() =>
                    deleteAlternative(alt.id).catch((err: unknown) =>
                      onError?.(errorMessage(err, `Failed to delete "${alt.name}".`))
                    )
                  }
                />
              ))
            )}
          </Box>
        </>
      )}

      <ResponsiveEditDrawer
        open={!!(addOpen || editing)}
        onClose={() => {
          setAddOpen(false);
          setEditingId(null);
        }}
      >
        {drawerContent}
      </ResponsiveEditDrawer>

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
