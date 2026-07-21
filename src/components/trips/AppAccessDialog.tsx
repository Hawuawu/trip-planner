import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import RemoveModeratorIcon from '@mui/icons-material/RemoveModerator';
import { useAuthStore } from '../../store/authStore';
import { extractInviteErrorMessage } from '../../utils/inviteErrors';
import type {
  AllowedUser,
  AccessRequest,
  AccessRequestStatus,
  AppActivityEntry,
  AppActivityType,
} from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
}

const ACTIVITY_LABELS: Record<AppActivityType, string> = {
  access_requested: 'Access requested',
  access_approved: 'Access approved',
  access_denied: 'Access denied',
  access_revoked: 'Access revoked',
  admin_granted: 'Made admin',
  admin_revoked: 'Admin removed',
};

const STATUS_COLORS: Record<AccessRequestStatus, 'default' | 'success' | 'warning' | 'error'> = {
  pending: 'warning',
  approved: 'success',
  denied: 'default',
  revoked: 'error',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

// Admin-only control panel for approval-based app access (#35): who can sign
// in, who's waiting for approval, and the access audit trail. All three lists
// are admin-read-only in Firestore rules; the mutations go through callables.
// Admin status itself is data-driven (the role field on an allowedUsers doc,
// see setAdminRole) rather than a fixed identity, so any admin can promote or
// demote any other — the server refuses to demote the last remaining one.
export function AppAccessDialog({ open, onClose }: Props) {
  const service = useAuthStore((s) => s.service);
  const approveAccess = useAuthStore((s) => s.approveAccess);
  const denyAccess = useAuthStore((s) => s.denyAccess);
  const revokeAccess = useAuthStore((s) => s.revokeAccess);
  const setAdminRole = useAuthStore((s) => s.setAdminRole);

  const [tab, setTab] = useState(0);
  const [allowedUsers, setAllowedUsers] = useState<AllowedUser[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [activity, setActivity] = useState<AppActivityEntry[]>([]);

  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !service) return;
    const unsubs = [
      service.subscribeToAllowedUsers(setAllowedUsers),
      service.subscribeToAccessRequests(setRequests),
      service.subscribeToAppActivity(setActivity),
    ];
    return () => unsubs.forEach((u) => u());
  }, [open, service]);

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  async function run(action: () => Promise<void>) {
    setActionError(null);
    setBusy(true);
    try {
      await action();
    } catch (err) {
      setActionError(extractInviteErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function handleConfirmRevoke() {
    const email = revokeTarget;
    if (!email) return;
    setRevokeTarget(null);
    void run(() => revokeAccess(email));
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle>App access</DialogTitle>
        <DialogContent>
          <Tabs value={tab} onChange={(_, v: number) => setTab(v)} sx={{ mb: 2 }}>
            <Tab label="People" />
            <Tab label={pendingCount > 0 ? `Requests (${pendingCount})` : 'Requests'} />
            <Tab label="Activity" />
          </Tabs>

          {actionError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>
              {actionError}
            </Alert>
          )}

          {tab === 0 && (
            <List dense data-testid="allowed-user-list">
              {allowedUsers.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No one has access yet.
                </Typography>
              )}
              {allowedUsers.map((u) => {
                const isAdmin = u.role === 'admin';
                return (
                  <ListItem key={u.email} disableGutters>
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <span>{u.email}</span>
                          {isAdmin && <Chip label="Admin" size="small" color="primary" />}
                        </Stack>
                      }
                      secondary={`${u.invitedVia === 'seed' ? 'Seeded' : 'Approved'} · ${formatDate(u.createdAt)}`}
                    />
                    <ListItemSecondaryAction>
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip title={isAdmin ? 'Remove admin' : 'Make admin'}>
                          <span>
                            <IconButton
                              size="small"
                              aria-label={
                                isAdmin ? `Remove admin for ${u.email}` : `Make ${u.email} admin`
                              }
                              disabled={busy}
                              onClick={() => void run(() => setAdminRole(u.email, !isAdmin))}
                            >
                              {isAdmin ? (
                                <RemoveModeratorIcon fontSize="small" />
                              ) : (
                                <AdminPanelSettingsIcon fontSize="small" />
                              )}
                            </IconButton>
                          </span>
                        </Tooltip>
                        <IconButton
                          size="small"
                          aria-label={`Revoke access for ${u.email}`}
                          title="Revoke access"
                          disabled={busy}
                          onClick={() => setRevokeTarget(u.email)}
                        >
                          <PersonRemoveIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </ListItemSecondaryAction>
                  </ListItem>
                );
              })}
            </List>
          )}

          {tab === 1 && (
            <List dense data-testid="access-request-list">
              {requests.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No one has asked for access yet. Signing in is the request — tell them to sign in
                  with Google once and they'll show up here.
                </Typography>
              )}
              {requests.map((request) => (
                <ListItem key={request.email} disableGutters>
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip
                          label={request.status}
                          size="small"
                          color={STATUS_COLORS[request.status]}
                          variant={request.status === 'denied' ? 'outlined' : 'filled'}
                        />
                        <span>{request.email}</span>
                      </Stack>
                    }
                    secondary={`${request.displayName ?? request.email} · last seen ${formatDate(request.lastSeenAt)}`}
                  />
                  <ListItemSecondaryAction>
                    {request.status !== 'approved' && (
                      <IconButton
                        size="small"
                        color="success"
                        aria-label={`Approve ${request.email}`}
                        title="Approve access"
                        disabled={busy}
                        onClick={() => void run(() => approveAccess(request.email))}
                      >
                        <CheckIcon fontSize="small" />
                      </IconButton>
                    )}
                    {request.status === 'pending' && (
                      <IconButton
                        size="small"
                        color="error"
                        aria-label={`Deny ${request.email}`}
                        title="Deny access"
                        disabled={busy}
                        onClick={() => void run(() => denyAccess(request.email))}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    )}
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}

          {tab === 2 && (
            <List dense data-testid="app-activity-list">
              {activity.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No activity yet.
                </Typography>
              )}
              {activity.map((entry) => (
                <ListItem key={entry.id} disableGutters>
                  <ListItemText
                    primary={`${ACTIVITY_LABELS[entry.type]}${entry.email ? ` — ${entry.email}` : ''}`}
                    secondary={formatDate(entry.createdAt)}
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

      <Dialog
        open={Boolean(revokeTarget)}
        onClose={() => setRevokeTarget(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Revoke app access</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Revoke app access for {revokeTarget}? They will no longer be able to sign in until
            approved again. Their trips and memberships are kept.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRevokeTarget(null)}>Cancel</Button>
          <Button color="error" onClick={handleConfirmRevoke}>
            Revoke
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
