import { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Chip,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/EditOutlined';
import type { Alternative } from '../../types';
import { CheckpointIcon } from '../timeline/CheckpointIcon';
import { getTagColor } from '../../utils/tagColors';
import { MarkdownNotes } from '../shared/MarkdownNotes';

interface Props {
  alternative: Alternative;
  onSelect(): void;
  onEdit(): void;
  onPromote(): void;
  onDelete(): void;
}

export function AlternativeItem({ alternative, onSelect, onEdit, onPromote, onDelete }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <Box
      onClick={onSelect}
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 1,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        px: 1.5,
        py: 1,
        mb: 1,
        cursor: 'pointer',
      }}
    >
      <Box sx={{ display: 'flex', gap: 1, minWidth: 0 }}>
        <Box
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              onEdit();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Edit alternative"
          sx={{ cursor: 'pointer', display: 'flex', mt: 0.35, flexShrink: 0 }}
        >
          <CheckpointIcon type={alternative.type} sx={{ fontSize: 18, color: 'text.secondary' }} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="body2"
            fontWeight={500}
            sx={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {alternative.name}
          </Typography>
          {alternative.location?.label && (
            <Typography
              variant="caption"
              color="text.secondary"
              component="div"
              sx={{ whiteSpace: 'normal' }}
            >
              {alternative.location.label}
            </Typography>
          )}
          {alternative.notes && (
            <MarkdownNotes
              notes={alternative.notes}
              variant="caption"
              sx={{ whiteSpace: 'normal' }}
            />
          )}
          {alternative.tags && alternative.tags.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
              {alternative.tags.map((tag) => {
                const color = getTagColor(tag);
                return (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    sx={{ height: 20, fontSize: '0.7rem', bgcolor: color.bg, color: color.fg }}
                  />
                );
              })}
            </Box>
          )}
        </Box>
      </Box>
      <Box sx={{ display: 'flex', flexShrink: 0, ml: 1 }}>
        <IconButton
          size="small"
          aria-label="Edit alternative"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          <EditIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          aria-label="Add to timeline"
          title="Add to timeline"
          onClick={(e) => {
            e.stopPropagation();
            onPromote();
          }}
        >
          <AddCircleOutlineIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          aria-label="Delete alternative"
          onClick={(e) => {
            e.stopPropagation();
            setConfirmOpen(true);
          }}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onClick={(e) => e.stopPropagation()}
      >
        <DialogTitle>Delete alternative?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Delete "{alternative.name}"? You can undo this right after.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              setConfirmOpen(false);
              onDelete();
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
