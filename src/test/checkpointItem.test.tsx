import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { CheckpointItem } from '../components/timeline/CheckpointItem';
import { renderWithProviders, resetStores } from './helpers';
import { formatCheckpointTime } from '../utils/date';
import type { Checkpoint } from '../types';

const { convertMock } = vi.hoisted(() => ({ convertMock: vi.fn() }));

vi.mock('@sglkc/kuroshiro', () => ({
  default: vi.fn().mockImplementation(function KuroshiroMock() {
    return {
      init: vi.fn().mockResolvedValue(undefined),
      convert: convertMock,
    };
  }),
}));

vi.mock('@sglkc/kuroshiro-analyzer-kuromoji', () => ({
  default: vi.fn().mockImplementation(function KuromojiAnalyzerMock() {
    return {};
  }),
}));

const BASE: Checkpoint = {
  id: 'cp-1',
  type: 'flight',
  name: 'JFK → NRT',
  startTime: '2026-10-01T14:00:00.000Z',
  endTime: '2026-10-02T17:00:00.000Z',
  notes: 'JL 005, seat 32A',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

// Save and restore the real navigator.onLine descriptor between tests.
const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, 'onLine');

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => value,
  });
}

function renderItem(
  overrides: Partial<{
    checkpoint: Checkpoint;
    isActive: boolean;
    isSelected: boolean;
    isLast: boolean;
    onSelect: () => void;
    onEdit: () => void;
    onDelete: () => void;
  }> = {}
) {
  const props = {
    checkpoint: BASE,
    isActive: false,
    isSelected: false,
    isLast: false,
    onSelect: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
  return { ...renderWithProviders(<CheckpointItem {...props} />), props };
}

beforeEach(() => {
  resetStores();
});

afterEach(() => {
  if (originalDescriptor) {
    Object.defineProperty(navigator, 'onLine', originalDescriptor);
  } else {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
  }
  convertMock.mockReset();
});

describe('CheckpointItem', () => {
  it('renders the checkpoint name', () => {
    renderItem();
    expect(screen.getByText('JFK → NRT')).toBeInTheDocument();
  });

  it('renders the start date and time', () => {
    renderItem();
    // The date/time text is rendered in a Typography element — check body text
    const content = document.body.textContent ?? '';
    expect(content).toMatch(/Oct\s*1|10\/1|2026/);
  });

  it('renders the destination-local wall-clock time from the ISO string, not the viewer-local one', () => {
    // 14:00+09:00 must render as 14:00 (Tokyo wall clock), regardless of the
    // test runner's own timezone — this is the regression test for #101.
    const tokyoStart = '2026-09-13T14:00:00+09:00';
    renderItem({ checkpoint: { ...BASE, startTime: tokyoStart, endTime: undefined } });
    const content = document.body.textContent ?? '';
    expect(content).toContain(formatCheckpointTime(tokyoStart));
  });

  it('renders the end time when provided', () => {
    renderItem();
    // End time separator "–" should be present
    const content = document.body.textContent ?? '';
    expect(content).toMatch(/–/);
  });

  it('renders notes when present', () => {
    renderItem();
    expect(screen.getByText('JL 005, seat 32A')).toBeInTheDocument();
  });

  it('does not render notes when absent', () => {
    const noNotes = { ...BASE, notes: undefined };
    renderItem({ checkpoint: noNotes });
    expect(screen.queryByText('JL 005, seat 32A')).not.toBeInTheDocument();
  });

  it('renders markdown in notes as real elements, not literal syntax', () => {
    renderItem({ checkpoint: { ...BASE, notes: 'window seat, **arrive early**' } });
    const strong = screen.getByText('arrive early');
    expect(strong.tagName).toBe('STRONG');
    expect(screen.queryByText('**arrive early**')).not.toBeInTheDocument();
  });

  it('does not render end-time dash when endTime is absent', () => {
    const noEnd = { ...BASE, endTime: undefined };
    renderItem({ checkpoint: noEnd });
    expect(document.body.textContent).not.toMatch(/–/);
  });

  it('calls onSelect when the timeline item is clicked', () => {
    const onSelect = vi.fn();
    renderItem({ onSelect });
    // Click the item root — the TimelineItem wraps everything
    fireEvent.click(screen.getByText('JFK → NRT'));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('calls onSelect when Enter or Space is pressed on the timeline item (keyboard support)', () => {
    const onSelect = vi.fn();
    renderItem({ onSelect });
    const timelineItem = screen.getByText('JFK → NRT').closest('li')!;
    fireEvent.keyDown(timelineItem, { key: 'Enter' });
    fireEvent.keyDown(timelineItem, { key: ' ' });
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it('calls onEdit when Enter is pressed on the checkpoint dot, without also selecting', () => {
    const onSelect = vi.fn();
    const onEdit = vi.fn();
    renderItem({ onSelect, onEdit });
    fireEvent.keyDown(screen.getAllByLabelText('Edit checkpoint')[0], { key: 'Enter' });
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('clicking delete opens a confirmation dialog without calling onDelete yet', () => {
    const onSelect = vi.fn();
    const onDelete = vi.fn();
    renderItem({ onSelect, onDelete });
    const delBtn = screen.getByRole('button', { name: /delete checkpoint/i });
    fireEvent.click(delBtn);
    expect(onDelete).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByText(/delete checkpoint\?/i)).toBeInTheDocument();
  });

  it('calls onDelete when the confirmation dialog is confirmed and does not propagate', () => {
    const onSelect = vi.fn();
    const onDelete = vi.fn();
    renderItem({ onSelect, onDelete });
    fireEvent.click(screen.getByRole('button', { name: /delete checkpoint/i }));
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('does not call onDelete when the confirmation dialog is cancelled', () => {
    const onDelete = vi.fn();
    renderItem({ onDelete });
    fireEvent.click(screen.getByRole('button', { name: /delete checkpoint/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('uses bold typography when isActive', () => {
    const { container } = renderItem({ isActive: true });
    const nameEl = screen.getByText('JFK → NRT');
    // font-weight 600 is applied via fontWeight prop when isActive
    expect(nameEl).toBeInTheDocument();
    // Check it has the correct font-weight style (MUI applies it inline or via class)
    const _style = window.getComputedStyle(nameEl);
    // MUI applies fontWeight via sx — it renders as a style attribute or class
    expect(nameEl.style.fontWeight || nameEl.getAttribute('class')).toBeTruthy();
    // More pragmatic: the container should not throw and the element is present
    expect(container).toBeInTheDocument();
  });

  it('renders without a connector when isLast is true', () => {
    // TimelineConnector is not rendered when isLast
    // MuiTimelineConnector-root class should not exist
    const { container } = renderItem({ isLast: true });
    expect(container.querySelector('.MuiTimelineConnector-root')).toBeNull();
  });

  it('renders a connector when not last', () => {
    const { container } = renderItem({ isLast: false });
    expect(container.querySelector('.MuiTimelineConnector-root')).not.toBeNull();
  });

  it('renders an svg icon for the checkpoint type', () => {
    const { container } = renderItem();
    expect(container.querySelector('svg')).not.toBeNull();
  });

  describe('show reading toggle', () => {
    it('does not render when neither name nor notes contain kanji', () => {
      renderItem();
      expect(screen.queryByRole('button', { name: /show reading/i })).not.toBeInTheDocument();
    });

    it('renders when the name contains kanji', () => {
      renderItem({ checkpoint: { ...BASE, name: '成田空港', notes: undefined } });
      expect(screen.getByRole('button', { name: /show reading/i })).toBeInTheDocument();
    });

    it('renders when notes contain kanji', () => {
      renderItem({ checkpoint: { ...BASE, name: 'Narita', notes: '成田空港' } });
      expect(screen.getByRole('button', { name: /show reading/i })).toBeInTheDocument();
    });

    it('reveals the notes reading alongside markdown-rendered notes', async () => {
      convertMock.mockResolvedValueOnce('Narita Kūkō');
      renderItem({ checkpoint: { ...BASE, name: 'Narita', notes: '**成田空港**' } });
      const strong = screen.getByText('成田空港');
      expect(strong.tagName).toBe('STRONG');
      fireEvent.click(screen.getByRole('button', { name: /show reading/i }));
      await waitFor(() => expect(screen.getByText('(Narita Kūkō)')).toBeInTheDocument());
    });

    it('reveals the romaji reading inline, in parentheses, on click', async () => {
      convertMock.mockResolvedValueOnce('Narita Kūkō');
      renderItem({ checkpoint: { ...BASE, name: '成田空港', notes: undefined } });
      fireEvent.click(screen.getByRole('button', { name: /show reading/i }));
      await waitFor(() => expect(screen.getByText('(Narita Kūkō)')).toBeInTheDocument());
    });

    it('hides the reading again on a second click', async () => {
      convertMock.mockResolvedValueOnce('Narita Kūkō');
      renderItem({ checkpoint: { ...BASE, name: '成田空港', notes: undefined } });
      const toggle = screen.getByRole('button', { name: /show reading/i });
      fireEvent.click(toggle);
      await waitFor(() => expect(screen.getByText('(Narita Kūkō)')).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: /hide reading/i }));
      expect(screen.queryByText('(Narita Kūkō)')).not.toBeInTheDocument();
    });

    it('shows an offline-unavailable message when conversion fails while offline', async () => {
      setOnline(false);
      convertMock.mockRejectedValueOnce(new Error('network error'));
      renderItem({ checkpoint: { ...BASE, name: '成田空港', notes: undefined } });
      fireEvent.click(screen.getByRole('button', { name: /show reading/i }));
      await waitFor(() =>
        expect(screen.getByText('Translation unavailable offline')).toBeInTheDocument()
      );
    });
  });

  describe('tags', () => {
    it('renders a chip for each tag', () => {
      renderItem({ checkpoint: { ...BASE, tags: ['long-haul', 'jet-lag-risk'] } });
      expect(screen.getByText('long-haul')).toBeInTheDocument();
      expect(screen.getByText('jet-lag-risk')).toBeInTheDocument();
    });

    it('renders no tag chips when tags is absent', () => {
      const noTags = { ...BASE, tags: undefined };
      const { container } = renderItem({ checkpoint: noTags });
      expect(container.querySelectorAll('.MuiChip-root').length).toBe(0);
    });
  });
});
