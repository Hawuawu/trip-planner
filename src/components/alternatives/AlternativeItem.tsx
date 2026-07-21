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
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/EditOutlined';
import type { Alternative } from '../../types';
import { CheckpointIcon } from '../timeline/CheckpointIcon';

interface Props {
  alternative: Alternative;
  onSelect(): void;
  onPromote(): void;
  onDelete(): void;
}

export function AlternativeItem({ alternative, onSelect, onPromote, onDelete }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <Box
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
      }}
    >
      <Box sx={{ display: 'flex', gap: 1, minWidth: 0 }}>
        <Box
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          role="button"
          aria-label="Edit alternative"
          sx={{ cursor: 'pointer', display: 'flex', mt: 0.35, flexShrink: 0 }}
        >
          <CheckpointIcon type={alternative.type} sx={{ fontSize: 18, color: 'text.secondary' }} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" fontWeight={500} noWrap>
            {alternative.name}
          </Typography>
          {(alternative.location?.label || alternative.notes) && (
            <Typography
              variant="caption"
              color="text.secondary"
              component="div"
              sx={{ whiteSpace: 'normal' }}
            >
              {alternative.location?.label ?? alternative.notes}
            </Typography>
          )}
        </Box>
      </Box>
      <Box sx={{ display: 'flex', flexShrink: 0, ml: 1 }}>
        <IconButton
          size="small"
          aria-label="Edit alternative"
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
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
