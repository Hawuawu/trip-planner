import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

function baseProps() {
  return {
    hasMore: false,
    loadingMore: false,
    onLoadMore: vi.fn(),
    search: '',
    onSearchChange: vi.fn(),
    actors: [] as string[],
    selectedActors: [] as string[],
    onToggleActor: vi.fn(),
  };
}

async function expandControls() {
  await userEvent.click(screen.getByRole('button', { name: /show search and filters/i }));
}

describe('ActivityLogView', () => {
  it('shows an access-denied message for non-owners', () => {
    renderWithProviders(
      <ActivityLogView open onClose={vi.fn()} entries={ENTRIES} isOwner={false} {...baseProps()} />
    );
    expect(screen.getByText('Only the trip owner can view the activity log.')).toBeInTheDocument();
    expect(screen.queryByTestId('activity-log-list')).not.toBeInTheDocument();
  });

  it('renders formatted entries for the owner', () => {
    renderWithProviders(
      <ActivityLogView open onClose={vi.fn()} entries={ENTRIES} isOwner {...baseProps()} />
    );
    expect(screen.getByText('Alice added checkpoint "Senso-ji"')).toBeInTheDocument();
    expect(screen.getByText('Bob joined the trip')).toBeInTheDocument();
  });

  it('shows an empty state when there are no entries and no filter is active', () => {
    renderWithProviders(
      <ActivityLogView open onClose={vi.fn()} entries={[]} isOwner {...baseProps()} />
    );
    expect(screen.getByText('No activity yet.')).toBeInTheDocument();
  });

  it('shows a distinct empty state when a search filter matches nothing', () => {
    renderWithProviders(
      <ActivityLogView
        open
        onClose={vi.fn()}
        entries={[]}
        isOwner
        {...baseProps()}
        search="nonexistent"
      />
    );
    expect(screen.getByText('No matching activity.')).toBeInTheDocument();
  });

  it('shows a distinct empty state when an actor filter matches nothing', () => {
    renderWithProviders(
      <ActivityLogView
        open
        onClose={vi.fn()}
        entries={[]}
        isOwner
        {...baseProps()}
        actors={['Alice']}
        selectedActors={['Alice']}
      />
    );
    expect(screen.getByText('No matching activity.')).toBeInTheDocument();
  });

  it('calls onClose when Close is clicked', async () => {
    const onClose = vi.fn();
    renderWithProviders(
      <ActivityLogView open onClose={onClose} entries={ENTRIES} isOwner {...baseProps()} />
    );
    screen.getByRole('button', { name: 'Close' }).click();
    expect(onClose).toHaveBeenCalled();
  });

  it('does not show a Load more button when hasMore is false', () => {
    renderWithProviders(
      <ActivityLogView open onClose={vi.fn()} entries={ENTRIES} isOwner {...baseProps()} />
    );
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
  });

  it('shows a Load more button when hasMore is true and calls onLoadMore on click', () => {
    const onLoadMore = vi.fn();
    renderWithProviders(
      <ActivityLogView
        open
        onClose={vi.fn()}
        entries={ENTRIES}
        isOwner
        {...baseProps()}
        hasMore
        loadingMore={false}
        onLoadMore={onLoadMore}
      />
    );
    const button = screen.getByRole('button', { name: /load more/i });
    button.click();
    expect(onLoadMore).toHaveBeenCalled();
  });

  it('disables the Load more button while loadingMore is true', () => {
    renderWithProviders(
      <ActivityLogView
        open
        onClose={vi.fn()}
        entries={ENTRIES}
        isOwner
        {...baseProps()}
        hasMore
        loadingMore
        onLoadMore={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /load more/i })).toBeDisabled();
  });

  it('does not show a Load more button for non-owners even when hasMore is true', () => {
    renderWithProviders(
      <ActivityLogView
        open
        onClose={vi.fn()}
        entries={ENTRIES}
        isOwner={false}
        {...baseProps()}
        hasMore
        loadingMore={false}
        onLoadMore={vi.fn()}
      />
    );
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
  });

  it('renders the search box and actor chips for owners once expanded', async () => {
    renderWithProviders(
      <ActivityLogView
        open
        onClose={vi.fn()}
        entries={ENTRIES}
        isOwner
        {...baseProps()}
        actors={['Alice', 'Bob']}
      />
    );
    await expandControls();
    expect(screen.getByPlaceholderText('Search activity log')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('fires onSearchChange when typing in the search box', async () => {
    const onSearchChange = vi.fn();
    renderWithProviders(
      <ActivityLogView
        open
        onClose={vi.fn()}
        entries={ENTRIES}
        isOwner
        {...baseProps()}
        onSearchChange={onSearchChange}
      />
    );
    await expandControls();
    await userEvent.type(screen.getByPlaceholderText('Search activity log'), 'a');
    expect(onSearchChange).toHaveBeenCalled();
  });

  it('fires onToggleActor when an actor chip is clicked', async () => {
    const onToggleActor = vi.fn();
    renderWithProviders(
      <ActivityLogView
        open
        onClose={vi.fn()}
        entries={ENTRIES}
        isOwner
        {...baseProps()}
        actors={['Alice']}
        onToggleActor={onToggleActor}
      />
    );
    await expandControls();
    await userEvent.click(screen.getByText('Alice'));
    expect(onToggleActor).toHaveBeenCalledWith('Alice');
  });

  it('hides search and filter controls entirely for non-owners', () => {
    renderWithProviders(
      <ActivityLogView
        open
        onClose={vi.fn()}
        entries={ENTRIES}
        isOwner={false}
        {...baseProps()}
        actors={['Alice']}
      />
    );
    expect(
      screen.queryByRole('button', { name: /show search and filters/i })
    ).not.toBeInTheDocument();
  });
});
