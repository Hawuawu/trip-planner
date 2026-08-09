import { useState, useRef, useEffect, useMemo } from 'react';
import { Box, Button, IconButton, Snackbar, Typography, CircularProgress } from '@mui/material';
import { Timeline } from '@mui/lab';
import AddIcon from '@mui/icons-material/Add';
import { useTripStore } from '../../store/tripStore';
import { CheckpointItem } from './CheckpointItem';
import { CheckpointForm } from './CheckpointForm';
import { ListControls } from '../shared/ListControls';
import { ResponsiveEditDrawer } from '../shared/ResponsiveEditDrawer';
import { collectAllTags, matchesAnyTag } from '../../utils/tags';
import { visibleCheckpoints } from '../../utils/checkpointVisibility';
import { formatDayLabel } from '../../utils/date';

interface Props {
  openAddSignal?: number;
  onSaved?: (message: string) => void;
  onError?: (message: string) => void;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export function TimelineView({ openAddSignal, onSaved, onError }: Props) {
  const {
    checkpoints,
    checkpointsLoading,
    alternatives,
    routes,
    selectedDay,
    selectedRouteId,
    selectedId,
    selectCheckpoint,
    addCheckpoint,
    updateCheckpoint,
    deleteCheckpoint,
    undoDelete,
    undoCheckpoint,
    clearUndo,
  } = useTripStore();

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [insertAfterIndex, setInsertAfterIndex] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const now = useRef(new Date().toISOString());
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map());
  const checkpointsRef = useRef(checkpoints);
  checkpointsRef.current = checkpoints;

  const activeId =
    checkpoints.find((c) => c.startTime > now.current)?.id ??
    checkpoints[checkpoints.length - 1]?.id;

  // Capture the initial active id in a ref so the scroll effect can include
  // it in the dependency array without re-triggering on checkpoint changes.
  const initialActiveId = useRef(activeId);

  useEffect(() => {
    const id = initialActiveId.current;
    if (id) {
      itemRefs.current.get(id)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, []); // runs once on mount — initialActiveId.current is stable

  // Opens the "add checkpoint" drawer when the parent (menu drawer) asks for
  // it — checkpointsRef keeps this effect from needing checkpoints as a dep.
  useEffect(() => {
    if (openAddSignal === undefined) return;
    setInsertAfterIndex(checkpointsRef.current.length - 1);
    setAdding(true);
  }, [openAddSignal]);

  function defaultStartForInsert(afterIndex: number | null): string {
    if (afterIndex === null || checkpoints.length === 0) return now.current;
    const after = checkpoints[afterIndex];
    const before = checkpoints[afterIndex + 1];
    if (!before) return after.startTime;
    const midMs = (new Date(after.startTime).getTime() + new Date(before.startTime).getTime()) / 2;
    return new Date(midMs).toISOString();
  }

  const editing = editingId ? checkpoints.find((c) => c.id === editingId) : null;

  const allTags = useMemo(
    () => collectAllTags(checkpoints, alternatives),
    [checkpoints, alternatives]
  );

  const dayRouteFiltered = useMemo(
    () => visibleCheckpoints(checkpoints, { selectedDay, selectedRouteId, routes }),
    [checkpoints, selectedDay, selectedRouteId, routes]
  );

  const filteredCheckpoints = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dayRouteFiltered.filter((cp) => {
      const matchesSearch =
        !q || [cp.name, cp.location?.label, cp.notes].some((f) => f?.toLowerCase().includes(q));
      return matchesSearch && matchesAnyTag(cp.tags, selectedTags);
    });
  }, [dayRouteFiltered, search, selectedTags]);

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  const activeRoute = selectedRouteId ? routes.find((r) => r.id === selectedRouteId) : undefined;
  const activeSelectionLabel =
    activeRoute && selectedDay
      ? `"${activeRoute.name}" on ${formatDayLabel(selectedDay)}`
      : activeRoute
        ? `"${activeRoute.name}"`
        : selectedDay
          ? formatDayLabel(selectedDay)
          : null;

  const drawerContent = adding ? (
    <CheckpointForm
      title="Add checkpoint"
      defaultStartTime={defaultStartForInsert(insertAfterIndex)}
      existingTags={allTags}
      onSave={async (data) => {
        try {
          await addCheckpoint(data);
          setAdding(false);
          onSaved?.(`Checkpoint "${data.name}" added.`);
        } catch (err) {
          onError?.(errorMessage(err, `Failed to add "${data.name}".`));
        }
      }}
      onCancel={() => setAdding(false)}
    />
  ) : editing ? (
    <CheckpointForm
      title="Edit checkpoint"
      initial={editing}
      existingTags={allTags}
      onSave={async (data) => {
        try {
          await updateCheckpoint(editing.id, data);
          setEditingId(null);
          onSaved?.(`Checkpoint "${data.name}" updated.`);
        } catch (err) {
          onError?.(errorMessage(err, `Failed to update "${data.name}".`));
        }
      }}
      onCancel={() => setEditingId(null)}
    />
  ) : null;

  return (
    <Box sx={{ position: 'relative', height: '100%', overflowY: 'auto' }}>
      {checkpointsLoading ? (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
          }}
        >
          <CircularProgress size={32} />
        </Box>
      ) : checkpoints.length === 0 ? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: 2,
            color: 'text.secondary',
          }}
        >
          <Typography variant="h6">No checkpoints yet</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setInsertAfterIndex(null);
              setAdding(true);
            }}
          >
            Add first checkpoint
          </Button>
        </Box>
      ) : dayRouteFiltered.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
          No checkpoints on {activeSelectionLabel}.
        </Typography>
      ) : (
        <>
          <ListControls
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search checkpoints…"
            allTags={allTags}
            selectedTags={selectedTags}
            onToggleTag={toggleTag}
          />

          {filteredCheckpoints.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
              No checkpoints match {search ? `"${search}"` : 'the selected tags'}.
            </Typography>
          ) : (
            <Timeline sx={{ p: 0, m: 0, pt: 2, pl: 2 }}>
              {filteredCheckpoints.map((cp, i) => (
                <Box
                  key={cp.id}
                  ref={(el) => {
                    if (el) itemRefs.current.set(cp.id, el as HTMLElement);
                    else itemRefs.current.delete(cp.id);
                  }}
                >
                  <CheckpointItem
                    checkpoint={cp}
                    isActive={cp.id === activeId}
                    isSelected={cp.id === selectedId}
                    isLast={i === filteredCheckpoints.length - 1}
                    onSelect={() => selectCheckpoint(cp.id === selectedId ? null : cp.id)}
                    onEdit={() => {
                      selectCheckpoint(cp.id);
                      setEditingId(cp.id);
                    }}
                    onDelete={() =>
                      deleteCheckpoint(cp.id).catch((err: unknown) =>
                        onError?.(errorMessage(err, `Failed to delete "${cp.name}".`))
                      )
                    }
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'center', my: -1 }}>
                    <IconButton
                      size="small"
                      aria-label="Add checkpoint here"
                      sx={{
                        width: 20,
                        height: 20,
                        opacity: 0,
                        '&:hover': { opacity: 1 },
                        color: 'text.secondary',
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                      onClick={() => {
                        // `i` is an index into `filteredCheckpoints`, but
                        // defaultStartForInsert looks up positions in the
                        // full `checkpoints` array — re-resolve by id so an
                        // active search/tag/day/route filter can't skew the
                        // insert time.
                        setInsertAfterIndex(checkpoints.findIndex((c) => c.id === cp.id));
                        setAdding(true);
                      }}
                    >
                      <AddIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Box>
                </Box>
              ))}
            </Timeline>
          )}
        </>
      )}

      <ResponsiveEditDrawer
        open={!!(adding || editing)}
        onClose={() => {
          setAdding(false);
          setEditingId(null);
        }}
      >
        {drawerContent}
      </ResponsiveEditDrawer>

      <Snackbar
        open={!!undoCheckpoint}
        message={`Deleted "${undoCheckpoint?.name}"`}
        autoHideDuration={4000}
        onClose={clearUndo}
        action={
          <Button color="secondary" size="small" onClick={undoDelete}>
            UNDO
          </Button>
        }
      />
    </Box>
  );
}
