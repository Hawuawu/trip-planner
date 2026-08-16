import { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Chip,
} from '@mui/material';
import {
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
} from '@mui/lab';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/EditOutlined';
import TranslateIcon from '@mui/icons-material/TranslateOutlined';
import type { Checkpoint } from '../../types';
import { CheckpointIcon } from './CheckpointIcon';
import { getTagColor } from '../../utils/tagColors';
import { hasKanji } from '../../utils/kanjiReading';
import { useKanjiReading } from '../../hooks/useKanjiReading';
import { InlineReading } from '../InlineReading';
import { MarkdownNotes } from '../shared/MarkdownNotes';
import { formatCheckpointTime, formatCheckpointDate } from '../../utils/date';

interface Props {
  checkpoint: Checkpoint;
  isActive: boolean;
  isSelected: boolean;
  isLast: boolean;
  onSelect(): void;
  onEdit(): void;
  onDelete(): void;
}

export function CheckpointItem({
  checkpoint,
  isActive,
  isSelected,
  isLast,
  onSelect,
  onEdit,
  onDelete,
}: Props) {
  const theme = useTheme();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const { state: nameReading, reveal: revealName } = useKanjiReading();
  const { state: notesReading, reveal: revealNotes } = useKanjiReading();
  const nameHasKanji = hasKanji(checkpoint.name);
  const notesHasKanji = hasKanji(checkpoint.notes ?? '');
  const showReadingToggle = nameHasKanji || notesHasKanji;

  return (
    <TimelineItem
      sx={{ cursor: 'pointer', '&:before': { flex: 0, padding: 0 } }}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Select ${checkpoint.name}`}
    >
      <TimelineSeparator>
        <TimelineDot
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
          tabIndex={0}
          aria-label="Edit checkpoint"
          sx={{
            cursor: 'pointer',
            bgcolor: isActive ? theme.palette.secondary.main : 'transparent',
            border: isActive ? 'none' : `2px solid ${theme.palette.divider}`,
            boxShadow: 'none',
            p: 0.5,
          }}
        >
          <CheckpointIcon
            type={checkpoint.type}
            sx={{
              fontSize: 18,
              color: isActive ? '#fff' : theme.palette.text.secondary,
            }}
          />
        </TimelineDot>
        {!isLast && <TimelineConnector sx={{ bgcolor: theme.palette.divider, width: '1px' }} />}
      </TimelineSeparator>

      <TimelineContent sx={{ py: 0, px: 2, mb: 2.5 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 1,
            bgcolor: 'background.paper',
            border: isSelected ? '2px solid' : '1px solid',
            borderColor: isSelected ? 'primary.main' : 'divider',
            borderRadius: 1,
            px: 1.5,
            py: 1,
            transition: 'border-color 0.15s, border-width 0.15s',
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="body1"
              fontWeight={isActive ? 600 : 400}
              lineHeight={1.3}
              sx={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {checkpoint.name}
              {revealed && nameHasKanji && <InlineReading state={nameReading} />}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {formatCheckpointDate(checkpoint.startTime)} ·{' '}
              {formatCheckpointTime(checkpoint.startTime)}
              {checkpoint.endTime && ` – ${formatCheckpointTime(checkpoint.endTime)}`}
            </Typography>
            {checkpoint.notes && (
              <Box sx={{ mt: 0.25 }}>
                <MarkdownNotes notes={checkpoint.notes} variant="body2" />
                {revealed && notesHasKanji && <InlineReading state={notesReading} />}
              </Box>
            )}
            {checkpoint.tags && checkpoint.tags.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                {checkpoint.tags.map((tag) => {
                  const color = getTagColor(tag);
                  return (
                    <Chip
                      key={tag}
                      label={tag}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.7rem',
                        bgcolor: color.bg,
                        color: color.fg,
                      }}
                    />
                  );
                })}
              </Box>
            )}
          </Box>
          <Box sx={{ display: 'flex', flexShrink: 0, ml: 1 }}>
            {showReadingToggle && (
              <IconButton
                size="small"
                aria-label={revealed ? 'Hide reading' : 'Show reading'}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!revealed) {
                    if (nameHasKanji) revealName(checkpoint.name);
                    if (notesHasKanji) revealNotes(checkpoint.notes ?? '');
                  }
                  setRevealed(!revealed);
                }}
              >
                <TranslateIcon fontSize="small" />
              </IconButton>
            )}
            <IconButton
              size="small"
              aria-label="Edit checkpoint"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              aria-label="Delete checkpoint"
              onClick={(e) => {
                e.stopPropagation();
                setConfirmOpen(true);
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      </TimelineContent>

      <Dialog
        open={confirmOpen}
        onClose={(_e, _reason) => setConfirmOpen(false)}
        onClick={(e) => e.stopPropagation()}
      >
        <DialogTitle>Delete checkpoint?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Delete "{checkpoint.name}"? You can undo this right after.
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
    </TimelineItem>
  );
}
