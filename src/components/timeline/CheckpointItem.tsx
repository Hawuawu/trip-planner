import { Box, Typography, IconButton, useTheme } from '@mui/material';
import { TimelineItem, TimelineSeparator, TimelineConnector, TimelineContent, TimelineDot } from '@mui/lab';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import type { Checkpoint } from '../../types';
import { CheckpointIcon } from './CheckpointIcon';

interface Props {
  checkpoint: Checkpoint;
  isActive: boolean;
  isSelected: boolean;
  isLast: boolean;
  onSelect(): void;
  onDelete(): void;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function CheckpointItem({ checkpoint, isActive, isSelected, isLast, onSelect, onDelete }: Props) {
  const theme = useTheme();

  return (
    <TimelineItem
      sx={{ cursor: 'pointer', '&:before': { flex: 0, padding: 0 } }}
      onClick={onSelect}
    >
      <TimelineSeparator>
        <TimelineDot
          sx={{
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
            bgcolor: isSelected ? 'action.selected' : 'transparent',
            borderRadius: 1,
            px: isSelected ? 1 : 0,
            py: isSelected ? 0.5 : 0,
            transition: 'background-color 0.15s',
          }}
        >
          <Box>
            <Typography variant="body1" fontWeight={isActive ? 600 : 400} lineHeight={1.3}>
              {checkpoint.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {formatDate(checkpoint.startTime)} · {formatTime(checkpoint.startTime)}
              {checkpoint.endTime && ` – ${formatTime(checkpoint.endTime)}`}
            </Typography>
            {checkpoint.notes && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, fontStyle: 'italic' }}>
                {checkpoint.notes}
              </Typography>
            )}
          </Box>
          <IconButton
            size="small"
            onClick={e => { e.stopPropagation(); onDelete(); }}
            sx={{ opacity: 0, '.MuiTimelineItem-root:hover &': { opacity: 1 }, ml: 1, flexShrink: 0 }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      </TimelineContent>
    </TimelineItem>
  );
}
