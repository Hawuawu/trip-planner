import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material';
import type { ActivityLogEntry } from '../../types';
import { formatActivityLogEntry } from '../../utils/activityLog';
import { ListControls } from '../shared/ListControls';

interface Props {
  open: boolean;
  onClose: () => void;
  entries: ActivityLogEntry[];
  isOwner: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  actors: string[];
  selectedActors: string[];
  onToggleActor: (actor: string) => void;
}

export function ActivityLogView({
  open,
  onClose,
  entries,
  isOwner,
  hasMore,
  loadingMore,
  onLoadMore,
  search,
  onSearchChange,
  actors,
  selectedActors,
  onToggleActor,
}: Props) {
  const isFiltered = search.trim().length > 0 || selectedActors.length > 0;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Activity log</DialogTitle>
      {isOwner && (
        <ListControls
          search={search}
          onSearchChange={onSearchChange}
          searchPlaceholder="Search activity log"
          allTags={actors}
          selectedTags={selectedActors}
          onToggleTag={onToggleActor}
        />
      )}
      <DialogContent>
        {!isOwner ? (
          <Typography color="text.secondary">
            Only the trip owner can view the activity log.
          </Typography>
        ) : entries.length === 0 ? (
          <Typography color="text.secondary">
            {isFiltered ? 'No matching activity.' : 'No activity yet.'}
          </Typography>
        ) : (
          <>
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
            {hasMore && (
              <Button
                onClick={onLoadMore}
                disabled={loadingMore}
                startIcon={loadingMore ? <CircularProgress size={16} /> : undefined}
                fullWidth
              >
                Load more
              </Button>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
