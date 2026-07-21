import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Stack,
  TextField,
  Button,
  Tooltip,
  Alert,
} from '@mui/material';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import type { Trip, InviteMemberResult } from '../../types';
import { canManage } from '../../utils/tripPermissions';
import { extractInviteErrorMessage } from '../../utils/inviteErrors';

interface Props {
  open: boolean;
  onClose: () => void;
  trip: Trip;
  currentUid: string | undefined;
  onInvite: (email: string) => Promise<InviteMemberResult>;
  onRemove: (uid: string) => Promise<void>;
  onLeave: () => Promise<void>;
}

export function TripMembersDialog({
  open,
  onClose,
  trip,
  currentUid,
  onInvite,
  onRemove,
  onLeave,
}: Props) {
  const [email, setEmail] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  const isOwner = canManage(trip, currentUid);

  function memberLabel(uid: string): string {
    const profile = trip.memberProfiles?.[uid];
    return profile?.email ?? profile?.displayName ?? `Member (${uid})`;
  }

  async function handleInvite() {
    setInviteError(null);
    setInviteSuccess(null);
    setInviting(true);
    try {
      const result = await onInvite(email.trim());
      if (result.status === 'already-member') {
        setInviteSuccess('They are already a member of this trip.');
      } else {
        setInviteSuccess(`Invited ${email.trim()}.`);
      }
      setEmail('');
    } catch (err) {
      setInviteError(extractInviteErrorMessage(err));
    } finally {
      setInviting(false);
    }
  }

  async function handleConfirmRemove() {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await onRemove(removeTarget);
    } finally {
      setRemoving(false);
      setRemoveTarget(null);
    }
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle>Trip members</DialogTitle>
        <DialogContent>
          <List dense data-testid="member-list">
            {trip.memberIds.map((uid) => {
              const isSelf = uid === currentUid;
              const isRowOwner = uid === trip.ownerId;
              // The owner has access from trip creation; every other member
              // is "pending" until recordTripAccess stamps joinedAt on their
              // first time actually opening the trip (see tripStore.init).
              const hasJoined = isRowOwner || Boolean(trip.memberProfiles?.[uid]?.joinedAt);
              return (
                <ListItem key={uid} disableGutters>
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <span>{memberLabel(uid)}</span>
                        {isSelf && <Chip label="You" size="small" variant="outlined" />}
                        {isRowOwner && <Chip label="Owner" size="small" color="primary" />}
                        {!isRowOwner &&
                          (hasJoined ? (
                            <Chip label="Joined" size="small" color="success" variant="outlined" />
                          ) : (
                            <Chip label="Pending" size="small" color="warning" />
                          ))}
                      </Stack>
                    }
                  />
                  <ListItemSecondaryAction>
                    {isOwner && !isRowOwner && (
                      <IconButton
                        size="small"
                        aria-label={`Remove ${memberLabel(uid)}`}
                        title="Remove member"
                        onClick={() => setRemoveTarget(uid)}
                      >
                        <PersonRemoveIcon fontSize="small" />
                      </IconButton>
                    )}
                    {isSelf && !isRowOwner && (
                      <Button size="small" color="error" onClick={() => void onLeave()}>
                        Leave
                      </Button>
                    )}
                    {isSelf && isRowOwner && (
                      <Tooltip title="Ownership transfer isn't supported yet — the owner can't leave while other members remain.">
                        <span>
                          <Button size="small" disabled>
                            Leave
                          </Button>
                        </span>
                      </Tooltip>
                    )}
                  </ListItemSecondaryAction>
                </ListItem>
              );
            })}
          </List>

          {isOwner && (
            <Stack spacing={1} sx={{ mt: 2 }}>
              <Stack direction="row" spacing={1}>
                <TextField
                  label="Invite by email"
                  size="small"
                  fullWidth
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  error={Boolean(inviteError)}
                  helperText={inviteError ?? undefined}
                  disabled={inviting}
                  inputProps={{ 'aria-label': 'Invite by email' }}
                />
                <Button
                  variant="contained"
                  onClick={() => void handleInvite()}
                  disabled={inviting || !email.trim()}
                >
                  Invite
                </Button>
              </Stack>
              {inviteSuccess && <Alert severity="success">{inviteSuccess}</Alert>}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Remove member</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Remove {removeTarget ? memberLabel(removeTarget) : ''} from this trip?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoveTarget(null)} disabled={removing}>
            Cancel
          </Button>
          <Button color="error" onClick={() => void handleConfirmRemove()} disabled={removing}>
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
