import { useState } from 'react';
import {
  Box, Typography, List, ListItem, ListItemIcon, ListItemText,
  IconButton, Button, Dialog, DialogTitle, DialogContent, TextField, DialogActions,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import { useTripStore } from '../../store/tripStore';
import { CheckpointIcon } from '../timeline/CheckpointIcon';

export function AlternativesShelf() {
  const { alternatives, deleteAlternative, promoteAlternative } = useTripStore();
  const [promoteId, setPromoteId] = useState<string | null>(null);
  const [promoteTime, setPromoteTime] = useState('');

  const promoting = alternatives.find(a => a.id === promoteId);

  function handlePromote() {
    if (!promoteId || !promoteTime) return;
    promoteAlternative(promoteId, new Date(promoteTime).toISOString());
    setPromoteId(null);
    setPromoteTime('');
  }

  return (
    <Box sx={{ p: 2, height: '100%', overflowY: 'auto' }}>
      <Typography variant="h6" gutterBottom>Alternatives</Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Shortlisted places — not on the timeline yet.
      </Typography>

      {alternatives.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No alternatives saved.</Typography>
      ) : (
        <List disablePadding>
          {alternatives.map(alt => (
            <ListItem
              key={alt.id}
              disableGutters
              sx={{
                border: '1.5px dashed',
                borderColor: 'divider',
                borderRadius: 1,
                mb: 1,
                px: 1.5,
                opacity: 0.8,
              }}
              secondaryAction={
                <Box>
                  <IconButton size="small" onClick={() => setPromoteId(alt.id)} title="Add to timeline">
                    <AddCircleOutlineIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => deleteAlternative(alt.id)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              }
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <CheckpointIcon type={alt.type} sx={{ fontSize: 18, color: 'text.secondary' }} />
              </ListItemIcon>
              <ListItemText
                primary={alt.name}
                secondary={alt.location?.label ?? alt.notes}
                primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                secondaryTypographyProps={{ variant: 'caption' }}
              />
            </ListItem>
          ))}
        </List>
      )}

      <Dialog open={!!promoteId} onClose={() => setPromoteId(null)}>
        <DialogTitle>Add "{promoting?.name}" to timeline</DialogTitle>
        <DialogContent>
          <TextField
            label="Start time"
            type="datetime-local"
            value={promoteTime}
            onChange={e => setPromoteTime(e.target.value)}
            fullWidth
            size="small"
            InputLabelProps={{ shrink: true }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPromoteId(null)}>Cancel</Button>
          <Button onClick={handlePromote} variant="contained" disabled={!promoteTime}>Add</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
