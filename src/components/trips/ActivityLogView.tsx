import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material';
import type { ActivityLogEntry } from '../../types';
import { formatActivityLogEntry } from '../../utils/activityLog';

interface Props {
  open: boolean;
  onClose: () => void;
  entries: ActivityLogEntry[];
  isOwner: boolean;
}

export function ActivityLogView({ open, onClose, entries, isOwner }: Props) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Activity log</DialogTitle>
      <DialogContent>
        {!isOwner ? (
          <Typography color="text.secondary">
            Only the trip owner can view the activity log.
          </Typography>
        ) : entries.length === 0 ? (
          <Typography color="text.secondary">No activity yet.</Typography>
        ) : (
          <List dense data-testid="activity-log-list">
            {entries.map((entry) => (
              <ListItem key={entry.id} disableGutters>
                <ListItemText
                  primary={formatActivityLogEntry(entry)}
                  secondary={new Date(entry.createdAt).toLocaleString()}
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
