import {
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Checkbox,
} from '@mui/material';
import type { Checkpoint } from '../../types';
import { formatCheckpointTime } from '../../utils/date';

interface Props {
  checkpoints: Checkpoint[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function CheckpointPicker({ checkpoints, selectedIds, onChange }: Props) {
  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((i) => i !== id) : [...selectedIds, id]);
  }

  return (
    <List dense sx={{ maxHeight: 280, overflowY: 'auto' }}>
      {checkpoints.map((cp) => {
        const time = formatCheckpointTime(cp.startTime);
        return (
          <ListItem key={cp.id} disablePadding>
            <ListItemButton onClick={() => toggle(cp.id)} dense>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <Checkbox
                  edge="start"
                  checked={selectedIds.includes(cp.id)}
                  tabIndex={-1}
                  disableRipple
                />
              </ListItemIcon>
              <ListItemText primary={cp.name} secondary={time} />
            </ListItemButton>
          </ListItem>
        );
      })}
    </List>
  );
}
