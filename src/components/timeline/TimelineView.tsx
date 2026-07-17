import { useState, useRef, useEffect } from 'react';
import {
  Box,
  Button,
  Fab,
  Snackbar,
  Typography,
  Drawer,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Timeline } from '@mui/lab';
import AddIcon from '@mui/icons-material/Add';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTripStore } from '../../store/tripStore';
import { CheckpointItem } from './CheckpointItem';
import { CheckpointForm } from './CheckpointForm';
import type { Checkpoint } from '../../types';

interface SortableCheckpointItemProps {
  cp: Checkpoint;
  isActive: boolean;
  isSelected: boolean;
  isLast: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onAddBetween: () => void;
  itemRef: (el: HTMLElement | null) => void;
}

function SortableCheckpointItem({
  cp,
  isActive,
  isSelected,
  isLast,
  onSelect,
  onDelete,
  onAddBetween,
  itemRef,
}: SortableCheckpointItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cp.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Box
      ref={(el) => {
        setNodeRef(el as HTMLElement | null);
        itemRef(el as HTMLElement | null);
      }}
      style={style}
      sx={{ display: 'flex', alignItems: 'flex-start' }}
    >
      <Box
        role="button"
        aria-label="drag handle"
        tabIndex={0}
        sx={{
          display: { xs: 'none', sm: 'flex' },
          alignItems: 'center',
          pt: 1.5,
          pl: 0.5,
          cursor: 'grab',
          color: 'text.disabled',
          '&:active': { cursor: 'grabbing' },
        }}
        {...attributes}
        {...listeners}
      >
        <DragIndicatorIcon fontSize="small" />
      </Box>
      <Box sx={{ flex: 1 }}>
        <CheckpointItem
          checkpoint={cp}
          isActive={isActive}
          isSelected={isSelected}
          isLast={isLast}
          onSelect={onSelect}
          onDelete={onDelete}
        />
        {!isLast && (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: -1 }}>
            <Button
              size="small"
              sx={{
                minWidth: 0,
                px: 1,
                py: 0,
                opacity: 0,
                '&:hover': { opacity: 1 },
                fontSize: '0.7rem',
                color: 'text.secondary',
              }}
              onClick={onAddBetween}
            >
              + add between
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  );
}

export function TimelineView() {
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
    reorderCheckpoints,
  } = useTripStore();

  const [adding, setAdding] = useState(false);
  const [insertAfterIndex, setInsertAfterIndex] = useState<number | null>(null);
  const now = useRef(new Date().toISOString());
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map());

  const activeId =
    checkpoints.find((c) => c.startTime > now.current)?.id ??
    checkpoints[checkpoints.length - 1]?.id;

  // Capture activeId at mount so the scroll-on-mount effect has a stable ref dep
  const activeIdAtMount = useRef(activeId);

  useEffect(() => {
    const id = activeIdAtMount.current;
    if (id) {
      itemRefs.current.get(id)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [activeIdAtMount]); // ref is stable — effect runs once on mount

  function defaultStartForInsert(afterIndex: number | null): string {
    if (afterIndex === null || checkpoints.length === 0) return now.current;
    const after = checkpoints[afterIndex];
    const before = checkpoints[afterIndex + 1];
    if (!before) return after.startTime;
    const midMs = (new Date(after.startTime).getTime() + new Date(before.startTime).getTime()) / 2;
    return new Date(midMs).toISOString();
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = checkpoints.findIndex((c) => c.id === active.id);
    const toIndex = checkpoints.findIndex((c) => c.id === over.id);
    if (fromIndex !== -1 && toIndex !== -1) {
      void reorderCheckpoints(fromIndex, toIndex);
    }
  }

  const editing = selectedId ? checkpoints.find((c) => c.id === selectedId) : null;

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
        selectCheckpoint(null);
      }}
      onCancel={() => selectCheckpoint(null)}
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
            height: '80%',
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
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={checkpoints.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <Timeline sx={{ p: 0, m: 0, pt: 2 }}>
              {checkpoints.map((cp, i) => (
                <SortableCheckpointItem
                  key={cp.id}
                  cp={cp}
                  isActive={cp.id === activeId}
                  isSelected={cp.id === selectedId}
                  isLast={i === checkpoints.length - 1}
                  onSelect={() => selectCheckpoint(cp.id === selectedId ? null : cp.id)}
                  onDelete={() => deleteCheckpoint(cp.id)}
                  onAddBetween={() => {
                    setInsertAfterIndex(i);
                    setAdding(true);
                  }}
                  itemRef={(el) => {
                    if (el) itemRefs.current.set(cp.id, el);
                    else itemRefs.current.delete(cp.id);
                  }}
                />
              ))}
            </Timeline>
          </SortableContext>
        </DndContext>
      )}

      {checkpoints.length > 0 && (
        <Fab
          color="secondary"
          size="medium"
          sx={{ position: 'fixed', bottom: isPhone ? 72 : 24, right: 24 }}
          onClick={() => {
            setInsertAfterIndex(checkpoints.length - 1);
            setAdding(true);
          }}
        >
          <AddIcon />
        </Fab>
      )}

      <Drawer
        anchor={isPhone ? 'bottom' : 'right'}
        open={!!(adding || (selectedId && editing))}
        onClose={() => {
          setAdding(false);
          selectCheckpoint(null);
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
