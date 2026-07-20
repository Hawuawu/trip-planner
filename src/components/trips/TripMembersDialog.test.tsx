import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TripMembersDialog } from './TripMembersDialog';
import { renderWithProviders } from '../../test/helpers';
import type { Trip } from '../../types';

const OWNED_TRIP: Trip = {
  id: 'trip-1',
  name: 'Japan 2026',
  dateRange: { start: '2026-10-01', end: '2026-10-14' },
  memberIds: ['owner-uid', 'member-uid'],
  ownerId: 'owner-uid',
  memberProfiles: {
    'owner-uid': { email: 'owner@example.com', displayName: 'Owner Person' },
    'member-uid': { email: 'member@example.com', displayName: 'Member Person' },
  },
};

function renderDialog(overrides: Partial<React.ComponentProps<typeof TripMembersDialog>> = {}) {
  const onInvite = vi.fn().mockResolvedValue({ status: 'invited', uid: 'new-uid' });
  const onRemove = vi.fn().mockResolvedValue(undefined);
  const onLeave = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  renderWithProviders(
    <TripMembersDialog
      open
      onClose={onClose}
      trip={OWNED_TRIP}
      currentUid="owner-uid"
      onInvite={onInvite}
      onRemove={onRemove}
      onLeave={onLeave}
      {...overrides}
    />
  );
  return { onInvite, onRemove, onLeave, onClose };
}

describe('TripMembersDialog', () => {
  it('lists all members by email, with owner and you chips', () => {
    renderDialog();
    expect(screen.getByText('owner@example.com')).toBeInTheDocument();
    expect(screen.getByText('member@example.com')).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(screen.getByText('You')).toBeInTheDocument();
  });

  it('falls back to display name when a member has no email', () => {
    renderDialog({
      trip: {
        ...OWNED_TRIP,
        memberProfiles: {
          ...OWNED_TRIP.memberProfiles,
          'member-uid': { email: null, displayName: 'Member Person' },
        },
      },
    });
    expect(screen.getByText('Member Person')).toBeInTheDocument();
  });

  it('falls back to a uid label for a member with no profile', () => {
    renderDialog({
      trip: {
        ...OWNED_TRIP,
        memberIds: ['owner-uid', 'ghost-uid'],
        memberProfiles: OWNED_TRIP.memberProfiles,
      },
    });
    expect(screen.getByText('Member (ghost-uid)')).toBeInTheDocument();
  });

  it('shows the invite field for the owner and calls onInvite', async () => {
    const { onInvite } = renderDialog();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Invite by email'), 'friend@example.com');
    await user.click(screen.getByRole('button', { name: 'Invite' }));
    await waitFor(() => expect(onInvite).toHaveBeenCalledWith('friend@example.com'));
    expect(await screen.findByText('Invited friend@example.com.')).toBeInTheDocument();
  });

  it('shows an already-member message without treating it as an error', async () => {
    const onInvite = vi.fn().mockResolvedValue({ status: 'already-member', uid: 'member-uid' });
    renderDialog({ onInvite });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Invite by email'), 'member@example.com');
    await user.click(screen.getByRole('button', { name: 'Invite' }));
    expect(await screen.findByText('They are already a member of this trip.')).toBeInTheDocument();
  });

  it('surfaces the thrown error message inline when invite fails', async () => {
    const onInvite = vi.fn().mockRejectedValue(new Error('This person hasn’t signed in yet.'));
    renderDialog({ onInvite });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Invite by email'), 'ghost@example.com');
    await user.click(screen.getByRole('button', { name: 'Invite' }));
    expect(await screen.findByText('This person hasn’t signed in yet.')).toBeInTheDocument();
  });

  it('shows a generic message instead of a raw error code when the invite call fails with no useful message (e.g. undeployed function)', async () => {
    const rawError = new Error('internal');
    (rawError as Error & { code: string }).code = 'functions/internal';
    const onInvite = vi.fn().mockRejectedValue(rawError);
    renderDialog({ onInvite });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Invite by email'), 'friend@example.com');
    await user.click(screen.getByRole('button', { name: 'Invite' }));
    expect(
      await screen.findByText('Something went wrong sending the invite. Please try again.')
    ).toBeInTheDocument();
    expect(screen.queryByText('internal')).not.toBeInTheDocument();
  });

  it('hides the invite field for a non-owner member', () => {
    renderDialog({ currentUid: 'member-uid' });
    expect(screen.queryByLabelText('Invite by email')).not.toBeInTheDocument();
  });

  it('lets the owner remove another member after confirming', async () => {
    const { onRemove } = renderDialog();
    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Remove member@example.com'));
    expect(screen.getByText(/Remove member@example\.com from this trip\?/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(onRemove).toHaveBeenCalledWith('member-uid'));
  });

  it('does not show a remove action on the owner row', () => {
    renderDialog();
    expect(screen.queryByLabelText('Remove owner@example.com')).not.toBeInTheDocument();
  });

  it('lets a non-owner member leave', async () => {
    const { onLeave } = renderDialog({ currentUid: 'member-uid' });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Leave' }));
    expect(onLeave).toHaveBeenCalled();
  });

  it('disables Leave for the owner', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: 'Leave' })).toBeDisabled();
  });
});
