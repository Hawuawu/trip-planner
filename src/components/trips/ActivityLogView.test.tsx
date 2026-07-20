import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { ActivityLogView } from './ActivityLogView';
import { renderWithProviders } from '../../test/helpers';
import type { ActivityLogEntry } from '../../types';

const ENTRIES: ActivityLogEntry[] = [
  {
    id: 'e1',
    type: 'checkpoint_added',
    actorUid: 'u1',
    actorLabel: 'Alice',
    entityName: 'Senso-ji',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'e2',
    type: 'member_joined',
    actorUid: 'u2',
    actorLabel: 'Bob',
    createdAt: '2026-01-02T00:00:00.000Z',
  },
];

describe('ActivityLogView', () => {
  it('shows an access-denied message for non-owners', () => {
    renderWithProviders(
      <ActivityLogView open onClose={vi.fn()} entries={ENTRIES} isOwner={false} />
    );
    expect(screen.getByText('Only the trip owner can view the activity log.')).toBeInTheDocument();
    expect(screen.queryByTestId('activity-log-list')).not.toBeInTheDocument();
  });

  it('renders formatted entries for the owner', () => {
    renderWithProviders(<ActivityLogView open onClose={vi.fn()} entries={ENTRIES} isOwner />);
    expect(screen.getByText('Alice added checkpoint "Senso-ji"')).toBeInTheDocument();
    expect(screen.getByText('Bob joined the trip')).toBeInTheDocument();
  });

  it('shows an empty state when there are no entries', () => {
    renderWithProviders(<ActivityLogView open onClose={vi.fn()} entries={[]} isOwner />);
    expect(screen.getByText('No activity yet.')).toBeInTheDocument();
  });

  it('calls onClose when Close is clicked', async () => {
    const onClose = vi.fn();
    renderWithProviders(<ActivityLogView open onClose={onClose} entries={ENTRIES} isOwner />);
    screen.getByRole('button', { name: 'Close' }).click();
    expect(onClose).toHaveBeenCalled();
  });
});
