import { useState, useRef, useEffect } from 'react';
import {
  Box,
  Button,
  IconButton,
  Snackbar,
  Typography,
  Drawer,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Timeline } from '@mui/lab';
import AddIcon from '@mui/icons-material/Add';
import { useTripStore } from '../../store/tripStore';
import { CheckpointItem } from './CheckpointItem';
import { CheckpointForm } from './CheckpointForm';

interface Props {
  openAddSignal?: number;
}

export function TimelineView({ openAddSignal }: Props) {
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'));

  const {
    checkpoints,
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

  const drawerContent = adding ? (
    <CheckpointForm
      title="Add checkpoint"
      defaultStartTime={defaultStartForInsert(insertAfterIndex)}
      onSave={async (data) => {
        await addCheckpoint(data);
        setAdding(false);
      }}
      onCancel={() => setAdding(false)}
    />
  ) : editing ? (
    <CheckpointForm
      title="Edit checkpoint"
      initial={editing}
      onSave={async (data) => {
        await updateCheckpoint(editing.id, data);
        setEditingId(null);
      }}
      onCancel={() => setEditingId(null)}
    />
  ) : null;

  return (
    <Box sx={{ position: 'relative', height: '100%', overflowY: 'auto' }}>
      {checkpoints.length === 0 ? (
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
      ) : (
        <Timeline sx={{ p: 0, m: 0, pt: 2, pl: 2 }}>
          {checkpoints.map((cp, i) => (
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
                isLast={i === checkpoints.length - 1}
                onSelect={() => selectCheckpoint(cp.id === selectedId ? null : cp.id)}
                onEdit={() => {
                  selectCheckpoint(cp.id);
                  setEditingId(cp.id);
                }}
                onDelete={() => deleteCheckpoint(cp.id)}
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
                    setInsertAfterIndex(i);
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

      <Drawer
        anchor={isPhone ? 'bottom' : 'right'}
        open={!!(adding || editing)}
        onClose={() => {
          setAdding(false);
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
