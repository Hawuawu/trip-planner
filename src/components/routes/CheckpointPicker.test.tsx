import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/helpers';
import { CheckpointPicker } from './CheckpointPicker';
import { formatCheckpointTime } from '../../utils/date';
import type { Checkpoint } from '../../types';

function makeCheckpoint(overrides: Partial<Checkpoint> = {}): Checkpoint {
  return {
    id: 'cp-1',
    type: 'poi',
    name: 'Fushimi Inari',
    startTime: '2026-09-05T09:00:00+09:00',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('CheckpointPicker', () => {
  it('renders each checkpoint name and its offset-aware time, independent of runner TZ', () => {
    const checkpoint = makeCheckpoint();
    renderWithProviders(
      <CheckpointPicker checkpoints={[checkpoint]} selectedIds={[]} onChange={vi.fn()} />
    );

    expect(screen.getByText('Fushimi Inari')).toBeInTheDocument();
    expect(screen.getByText(formatCheckpointTime(checkpoint.startTime))).toBeInTheDocument();
  });

  it('reflects selected checkpoints as checked and toggles on click', () => {
    const checkpoint = makeCheckpoint();
    const onChange = vi.fn();
    renderWithProviders(
      <CheckpointPicker
        checkpoints={[checkpoint]}
        selectedIds={[checkpoint.id]}
        onChange={onChange}
      />
    );

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();

    screen.getByText('Fushimi Inari').click();
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
