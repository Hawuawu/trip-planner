import { useState } from 'react';
import {
  Avatar,
  Box,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuthStore } from '../../store/authStore';

function initials(displayName: string | null, email: string | null): string {
  if (displayName) {
    const parts = displayName.trim().split(/\s+/).filter(Boolean);
    return parts
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join('');
  }
  if (email) return email[0]!.toUpperCase();
  return '?';
}

export function AccountMenu() {
  const user = useAuthStore((s) => s.user);
  const service = useAuthStore((s) => s.service);
  const signOut = useAuthStore((s) => s.signOut);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  if (!service || !user) return null;

  const label = user.displayName ?? user.email ?? 'signed-in user';

  return (
    <>
      <IconButton
        size="small"
        aria-label={`Account menu for ${label}`}
        title={label}
        onClick={(e) => setAnchorEl(e.currentTarget)}
      >
        {user.photoURL ? (
          <Avatar src={user.photoURL} sx={{ width: 32, height: 32 }} />
        ) : (
          <Avatar sx={{ width: 32, height: 32 }}>{initials(user.displayName, user.email)}</Avatar>
        )}
      </IconButton>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="subtitle2">{user.displayName ?? user.email}</Typography>
          {user.displayName && user.email && (
            <Typography variant="body2" color="text.secondary">
              {user.email}
            </Typography>
          )}
        </Box>
        <Divider />
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            void signOut();
          }}
        >
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Sign out</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}
