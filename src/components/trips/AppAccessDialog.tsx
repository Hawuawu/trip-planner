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
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AddLinkIcon from '@mui/icons-material/AddLink';
import { useAuthStore } from '../../store/authStore';
import { isAdminEmail } from '../../config/admin';
import { extractInviteErrorMessage } from '../../utils/inviteErrors';
import type { AllowedUser, AppInvite, AppActivityEntry, AppActivityType } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
}

const ACTIVITY_LABELS: Record<AppActivityType, string> = {
  invite_created: 'Invite link created',
  invite_redeemed: 'Invite redeemed',
  invite_cancelled: 'Invite cancelled',
  access_revoked: 'Access revoked',
  sign_in_rejected: 'Sign-in rejected',
};

const STATUS_COLORS: Record<AppInvite['status'], 'default' | 'success' | 'warning'> = {
  pending: 'warning',
  redeemed: 'success',
  cancelled: 'default',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

// Admin-only control panel for the app-wide invite gate (#35): who can sign
// in, outstanding invite links, and the access audit trail. All three lists
// are admin-read-only in Firestore rules; the mutations go through callables.
export function AppAccessDialog({ open, onClose }: Props) {
  const service = useAuthStore((s) => s.service);
  const createInvite = useAuthStore((s) => s.createInvite);
  const cancelInvite = useAuthStore((s) => s.cancelInvite);
  const revokeAccess = useAuthStore((s) => s.revokeAccess);

  const [tab, setTab] = useState(0);
  const [allowedUsers, setAllowedUsers] = useState<AllowedUser[]>([]);
  const [invites, setInvites] = useState<AppInvite[]>([]);
  const [activity, setActivity] = useState<AppActivityEntry[]>([]);

  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !service) return;
    const unsubs = [
      service.subscribeToAllowedUsers(setAllowedUsers),
      service.subscribeToInvites(setInvites),
      service.subscribeToAppActivity(setActivity),
    ];
    return () => unsubs.forEach((u) => u());
  }, [open, service]);

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

  function handleCreateInvite() {
    void run(async () => {
      const token = await createInvite();
      setInviteLink(`${location.origin}/?invite=${token}`);
      setCopied(false);
    });
  }

  function handleCopy() {
    if (!inviteLink) return;
    void navigator.clipboard.writeText(inviteLink).then(() => setCopied(true));
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
            <Tab label="Invites" />
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
              {allowedUsers.map((u) => (
                <ListItem key={u.email} disableGutters>
                  <ListItemText
                    primary={u.email}
                    secondary={`${u.invitedVia === 'seed' ? 'Seeded' : 'Invited'} · ${formatDate(u.createdAt)}`}
                  />
                  <ListItemSecondaryAction>
                    {isAdminEmail(u.email) ? (
                      <Chip label="Admin" size="small" color="primary" />
                    ) : (
                      <IconButton
                        size="small"
                        aria-label={`Revoke access for ${u.email}`}
                        title="Revoke access"
                        disabled={busy}
                        onClick={() => setRevokeTarget(u.email)}
                      >
                        <PersonRemoveIcon fontSize="small" />
                      </IconButton>
                    )}
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}

          {tab === 1 && (
            <Stack spacing={2}>
              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  startIcon={<AddLinkIcon />}
                  onClick={handleCreateInvite}
                  disabled={busy}
                >
                  New invite link
                </Button>
              </Stack>
              {inviteLink && (
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField
                    size="small"
                    fullWidth
                    value={inviteLink}
                    inputProps={{ readOnly: true, 'aria-label': 'Invite link' }}
                  />
                  <Tooltip title={copied ? 'Copied!' : 'Copy link'}>
                    <IconButton aria-label="Copy invite link" onClick={handleCopy}>
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              )}
              <List dense data-testid="invite-list">
                {invites.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    No invites yet.
                  </Typography>
                )}
                {invites.map((invite) => (
                  <ListItem key={invite.token} disableGutters>
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip
                            label={invite.status}
                            size="small"
                            color={STATUS_COLORS[invite.status]}
                            variant={invite.status === 'cancelled' ? 'outlined' : 'filled'}
                          />
                          <span>{invite.redeemedEmail ?? 'Not redeemed'}</span>
                        </Stack>
                      }
                      secondary={`Created ${formatDate(invite.createdAt)}`}
                    />
                    {invite.status === 'pending' && (
                      <ListItemSecondaryAction>
                        <Button
                          size="small"
                          color="error"
                          disabled={busy}
                          onClick={() => void run(() => cancelInvite(invite.token))}
                        >
                          Cancel
                        </Button>
                      </ListItemSecondaryAction>
                    )}
                  </ListItem>
                ))}
              </List>
            </Stack>
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
            invited again. Their trips and memberships are kept.
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
