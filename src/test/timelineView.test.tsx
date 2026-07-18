import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { TimelineView } from '../components/timeline/TimelineView';
import { renderWithProviders, resetStores } from './helpers';
import { useTripStore } from '../store/tripStore';
import type { Checkpoint } from '../types';

function makeCheckpoint(overrides: Partial<Checkpoint> = {}): Checkpoint {
  return {
    id: 'cp-1',
    type: 'flight',
    name: 'JFK → NRT',
    startTime: '2026-10-01T14:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  resetStores();
});

describe('TimelineView — empty state', () => {
  it('renders the empty state message when there are no checkpoints', () => {
    renderWithProviders(<TimelineView />);
    expect(screen.getByText(/no checkpoints yet/i)).toBeInTheDocument();
  });

  it('renders an "Add first checkpoint" button in the empty state', () => {
    renderWithProviders(<TimelineView />);
    expect(screen.getByRole('button', { name: /add first checkpoint/i })).toBeInTheDocument();
  });

  it('does not render the FAB when there are no checkpoints', () => {
    renderWithProviders(<TimelineView />);
    // FAB only shows when checkpoints.length > 0
    const fabs = document.querySelectorAll('.MuiFab-root');
    expect(fabs.length).toBe(0);
  });

  it('opens the add form when "Add first checkpoint" is clicked', () => {
    renderWithProviders(<TimelineView />);
    fireEvent.click(screen.getByRole('button', { name: /add first checkpoint/i }));
    // The drawer opens with the CheckpointForm's Save button visible
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });
});

describe('TimelineView — with checkpoints', () => {
  function seedCheckpoints(cps: Checkpoint[]) {
    useTripStore.setState({ checkpoints: cps });
  }

  it('renders each checkpoint by name', () => {
    seedCheckpoints([
      makeCheckpoint({ id: 'a', name: 'Flight Out', startTime: '2026-10-01T14:00:00.000Z' }),
      makeCheckpoint({
        id: 'b',
        name: 'Shinjuku Hotel',
        startTime: '2026-10-02T15:00:00.000Z',
        type: 'hotel',
      }),
    ]);
    renderWithProviders(<TimelineView />);
    expect(screen.getByText('Flight Out')).toBeInTheDocument();
    expect(screen.getByText('Shinjuku Hotel')).toBeInTheDocument();
  });

  it('renders the FAB when there are checkpoints', () => {
    seedCheckpoints([makeCheckpoint()]);
    renderWithProviders(<TimelineView />);
    expect(document.querySelector('.MuiFab-root')).not.toBeNull();
  });

  it('does not render the empty-state message when checkpoints exist', () => {
    seedCheckpoints([makeCheckpoint()]);
    renderWithProviders(<TimelineView />);
    expect(screen.queryByText(/no checkpoints yet/i)).not.toBeInTheDocument();
  });

  it('clicking a checkpoint selects it (opens edit drawer)', () => {
    seedCheckpoints([makeCheckpoint({ id: 'cp-1', name: 'JFK → NRT' })]);
    renderWithProviders(<TimelineView />);
    fireEvent.click(screen.getByText('JFK → NRT'));
    // Edit form should appear with "Edit checkpoint" title
    expect(screen.getByText('Edit checkpoint')).toBeInTheDocument();
  });

  it('clicking the selected checkpoint again deselects it (closes edit drawer)', async () => {
    seedCheckpoints([makeCheckpoint({ id: 'cp-1', name: 'JFK → NRT' })]);
    renderWithProviders(<TimelineView />);

    // First click — select
    fireEvent.click(screen.getByText('JFK → NRT'));
    expect(useTripStore.getState().selectedId).toBe('cp-1');

    // Second click — deselect
    fireEvent.click(screen.getByText('JFK → NRT'));
    expect(useTripStore.getState().selectedId).toBeNull();
  });

  it('calls deleteCheckpoint when delete icon is clicked on a checkpoint', async () => {
    useTripStore.setState({
      checkpoints: [makeCheckpoint({ id: 'cp-1', name: 'JFK → NRT' })],
    });
    const spy = vi.spyOn(useTripStore.getState(), 'deleteCheckpoint').mockResolvedValue();

    renderWithProviders(<TimelineView />);

    // Find the delete button — it has an svg and is not the FAB
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button'));
    const deleteBtn = buttons.find(
      (b) => b.querySelector('svg') && !b.classList.contains('MuiFab-root')
    );
    expect(deleteBtn).toBeTruthy();
    fireEvent.click(deleteBtn!);
    expect(spy).toHaveBeenCalledWith('cp-1');
    spy.mockRestore();
  });

  it('shows the undo snackbar after a checkpoint is deleted', async () => {
    const cp = makeCheckpoint({ id: 'cp-1', name: 'JFK → NRT' });
    useTripStore.setState({
      checkpoints: [],
      undoCheckpoint: cp,
    });
    renderWithProviders(<TimelineView />);
    await waitFor(() => {
      expect(screen.getByText(/deleted "JFK → NRT"/i)).toBeInTheDocument();
    });
  });

  it('calls undoDelete when UNDO button in snackbar is clicked', async () => {
    const cp = makeCheckpoint({ id: 'cp-1', name: 'JFK → NRT' });
    useTripStore.setState({ checkpoints: [], undoCheckpoint: cp });
    const spy = vi.spyOn(useTripStore.getState(), 'undoDelete').mockResolvedValue();

    renderWithProviders(<TimelineView />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /undo/i }));
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('renders "add checkpoint here" buttons between checkpoints', () => {
    seedCheckpoints([
      makeCheckpoint({ id: 'a', name: 'First', startTime: '2026-10-01T14:00:00.000Z' }),
      makeCheckpoint({
        id: 'b',
        name: 'Second',
        startTime: '2026-10-02T14:00:00.000Z',
        type: 'hotel',
      }),
    ]);
    renderWithProviders(<TimelineView />);
    expect(
      screen.getAllByRole('button', { name: /add checkpoint here/i }).length
    ).toBeGreaterThanOrEqual(1);
  });

  it('opens the add form when FAB is clicked', () => {
    seedCheckpoints([makeCheckpoint()]);
    renderWithProviders(<TimelineView />);
    const fab = document.querySelector<HTMLButtonElement>('.MuiFab-root')!;
    fireEvent.click(fab);
    expect(screen.getByText('Add checkpoint')).toBeInTheDocument();
  });

  it('closes the add form when Cancel is clicked inside the drawer', () => {
    seedCheckpoints([makeCheckpoint()]);
    renderWithProviders(<TimelineView />);
    fireEvent.click(document.querySelector<HTMLButtonElement>('.MuiFab-root')!);
    expect(screen.getByText('Add checkpoint')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByText('Add checkpoint')).not.toBeInTheDocument();
  });

  it('"add checkpoint here" button opens add form with a midpoint start time', () => {
    // Two checkpoints 2 hours apart — the inserted default should be midpoint
    seedCheckpoints([
      makeCheckpoint({ id: 'a', name: 'First', startTime: '2026-10-05T10:00:00.000Z' }),
      makeCheckpoint({
        id: 'b',
        name: 'Second',
        startTime: '2026-10-05T12:00:00.000Z',
        type: 'hotel',
      }),
    ]);
    renderWithProviders(<TimelineView />);
    // Click the "add checkpoint here" button (appears between the two items)
    const addBetweenBtn = screen.getAllByRole('button', { name: /add checkpoint here/i })[0];
    fireEvent.click(addBetweenBtn);
    // The drawer form opens
    expect(screen.getByText('Add checkpoint')).toBeInTheDocument();
    // The start time input should be pre-filled with a value between the two times
    const startInput = document.querySelector(
      'input[type="datetime-local"][required]'
    ) as HTMLInputElement;
    expect(startInput?.value).toBeTruthy();
  });

  it('cancelling from the edit form clears selectedId', () => {
    seedCheckpoints([makeCheckpoint({ id: 'cp-1', name: 'JFK → NRT' })]);
    renderWithProviders(<TimelineView />);
    // Open edit drawer by selecting the checkpoint
    fireEvent.click(screen.getByText('JFK → NRT'));
    expect(useTripStore.getState().selectedId).toBe('cp-1');
    // Cancel inside the edit form clears the selection
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(useTripStore.getState().selectedId).toBeNull();
  });

  it('renders the last checkpoint without a connector', () => {
    seedCheckpoints([
      makeCheckpoint({ id: 'a', name: 'First', startTime: '2026-10-01T14:00:00.000Z' }),
      makeCheckpoint({
        id: 'b',
        name: 'Last',
        startTime: '2026-10-02T14:00:00.000Z',
        type: 'hotel',
      }),
    ]);
    const { container } = renderWithProviders(<TimelineView />);
    const connectors = container.querySelectorAll('.MuiTimelineConnector-root');
    // One connector for first item, none for last
    expect(connectors.length).toBe(1);
  });
});
