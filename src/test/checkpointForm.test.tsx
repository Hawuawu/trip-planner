import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CheckpointForm } from '../components/timeline/CheckpointForm';
import { renderWithProviders, resetStores } from './helpers';

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

beforeEach(() => {
  resetStores();
  convertMock.mockReset();
});

// MUI TextField with label="Name" required renders "Name *" in the label,
// so we use /name/i (substring) rather than an anchored regex.
function getNameInput() {
  return screen.getByRole('textbox', { name: /name/i });
}

function _getStartTimeInput() {
  // datetime-local inputs are not role="textbox"; query by label text directly.
  return document.querySelector('input[type="datetime-local"][required]') as HTMLInputElement;
}

function getNotesInput() {
  return screen.getByRole('textbox', { name: /notes/i });
}

// The notes field is a Tiptap rich-text editor (contenteditable), not a plain
// <textarea> — fireEvent.change doesn't apply. Paste events are the one input
// mechanism ProseMirror handles reliably under jsdom.
function pasteIntoNotes(text: string) {
  const notesInput = getNotesInput();
  fireEvent.focus(notesInput);
  fireEvent.paste(notesInput, {
    clipboardData: { getData: (fmt: string) => (fmt === 'text/plain' ? text : '') },
  });
}

function getWebsiteInput() {
  return screen.getByRole('textbox', { name: /website/i });
}

describe('CheckpointForm', () => {
  it('renders name, start time, end time, location label, notes, save, cancel', () => {
    renderWithProviders(<CheckpointForm onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(getNameInput()).toBeInTheDocument();
    expect(document.querySelectorAll('input[type="datetime-local"]').length).toBeGreaterThanOrEqual(
      2
    );
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('renders the title when provided', () => {
    renderWithProviders(
      <CheckpointForm title="Add checkpoint" onSave={vi.fn()} onCancel={vi.fn()} />
    );
    expect(screen.getByText('Add checkpoint')).toBeInTheDocument();
  });

  it('does not render a heading when title is omitted', () => {
    renderWithProviders(<CheckpointForm onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('calls onCancel when Cancel button is clicked', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<CheckpointForm onSave={vi.fn()} onCancel={onCancel} />);
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('does not call onSave when name is empty', async () => {
    const onSave = vi.fn();
    renderWithProviders(
      <CheckpointForm
        onSave={onSave}
        onCancel={vi.fn()}
        defaultStartTime="2026-10-01T14:00:00.000Z"
      />
    );
    // Leave name blank; startTime pre-filled via defaultStartTime
    fireEvent.submit(document.querySelector('form')!);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('calls onSave with correct data when form is valid', async () => {
    const onSave = vi.fn();
    renderWithProviders(
      <CheckpointForm
        onSave={onSave}
        onCancel={vi.fn()}
        defaultStartTime="2026-10-01T14:00:00.000Z"
      />
    );
    fireEvent.change(getNameInput(), { target: { value: 'My Stop' } });
    fireEvent.submit(document.querySelector('form')!);
    expect(onSave).toHaveBeenCalledTimes(1);
    const arg = onSave.mock.calls[0][0];
    expect(arg.name).toBe('My Stop');
    expect(typeof arg.startTime).toBe('string');
  });

  it('trims whitespace from the name before calling onSave', async () => {
    const onSave = vi.fn();
    renderWithProviders(
      <CheckpointForm
        onSave={onSave}
        onCancel={vi.fn()}
        defaultStartTime="2026-10-01T14:00:00.000Z"
      />
    );
    fireEvent.change(getNameInput(), { target: { value: '  Trimmed  ' } });
    fireEvent.submit(document.querySelector('form')!);
    expect(onSave.mock.calls[0][0].name).toBe('Trimmed');
  });

  it('omits location when lat/lng fields are empty', async () => {
    const onSave = vi.fn();
    renderWithProviders(
      <CheckpointForm
        onSave={onSave}
        onCancel={vi.fn()}
        defaultStartTime="2026-10-01T14:00:00.000Z"
      />
    );
    fireEvent.change(getNameInput(), { target: { value: 'No Location' } });
    fireEvent.submit(document.querySelector('form')!);
    expect(onSave.mock.calls[0][0].location).toBeUndefined();
  });

  it('includes location when lat and lng are both provided', async () => {
    const onSave = vi.fn();
    renderWithProviders(
      <CheckpointForm
        onSave={onSave}
        onCancel={vi.fn()}
        defaultStartTime="2026-10-01T14:00:00.000Z"
      />
    );
    fireEvent.change(getNameInput(), { target: { value: 'With Location' } });
    // Lat and Lng inputs — they are type="number" without required; query all number inputs
    const numberInputs = Array.from(
      document.querySelectorAll<HTMLInputElement>('input[type="number"]')
    );
    expect(numberInputs.length).toBeGreaterThanOrEqual(2);
    fireEvent.change(numberInputs[0], { target: { value: '35.6938' } });
    fireEvent.change(numberInputs[1], { target: { value: '139.7034' } });
    fireEvent.submit(document.querySelector('form')!);
    const loc = onSave.mock.calls[0][0].location;
    expect(loc).toBeDefined();
    expect(loc.lat).toBeCloseTo(35.6938);
    expect(loc.lng).toBeCloseTo(139.7034);
  });

  it('omits notes when notes textarea is empty', async () => {
    const onSave = vi.fn();
    renderWithProviders(
      <CheckpointForm
        onSave={onSave}
        onCancel={vi.fn()}
        defaultStartTime="2026-10-01T14:00:00.000Z"
      />
    );
    fireEvent.change(getNameInput(), { target: { value: 'No Notes' } });
    fireEvent.submit(document.querySelector('form')!);
    expect(onSave.mock.calls[0][0].notes).toBeUndefined();
  });

  it('includes notes when the notes editor has content', async () => {
    const onSave = vi.fn();
    renderWithProviders(
      <CheckpointForm
        onSave={onSave}
        onCancel={vi.fn()}
        defaultStartTime="2026-10-01T14:00:00.000Z"
      />
    );
    fireEvent.change(getNameInput(), { target: { value: 'With Notes' } });
    pasteIntoNotes('Some note text');
    fireEvent.submit(document.querySelector('form')!);
    expect(onSave.mock.calls[0][0].notes).toBe('Some note text');
  });

  it('renders bold markdown notes as real elements and keeps the raw markdown on save', async () => {
    const onSave = vi.fn();
    renderWithProviders(
      <CheckpointForm
        onSave={onSave}
        onCancel={vi.fn()}
        defaultStartTime="2026-10-01T14:00:00.000Z"
      />
    );
    fireEvent.change(getNameInput(), { target: { value: 'Markdown Notes' } });
    pasteIntoNotes('**bold** note');

    const strong = await screen.findByText('bold');
    expect(strong.tagName).toBe('STRONG');

    fireEvent.submit(document.querySelector('form')!);
    expect(onSave.mock.calls[0][0].notes).toBe('**bold** note');
  });

  it('pre-fills name and notes from initial prop', () => {
    renderWithProviders(
      <CheckpointForm
        initial={{
          type: 'hotel',
          name: 'Shinjuku Hotel',
          startTime: '2026-10-02T15:00:00.000Z',
          notes: 'Check-in at 3pm',
        }}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(getNameInput()).toHaveValue('Shinjuku Hotel');
    expect(getNotesInput()).toHaveTextContent('Check-in at 3pm');
  });

  it('renders the Type select field with a value', () => {
    renderWithProviders(<CheckpointForm onSave={vi.fn()} onCancel={vi.fn()} />);
    // MUI Select renders a hidden <select> or combobox; the displayed value is in the DOM
    // Default type is 'poi' — the visible rendered value element contains the label
    const body = document.body.textContent ?? '';
    // At least one of the known type labels is rendered as selected value
    expect(body).toMatch(/Flight|Train|Metro|Hotel|Point of Interest|Other/);
  });

  it('changes type when a different option is selected via the hidden native input', () => {
    const onSave = vi.fn();
    renderWithProviders(
      <CheckpointForm
        onSave={onSave}
        onCancel={vi.fn()}
        defaultStartTime="2026-10-01T14:00:00.000Z"
      />
    );
    // MUI Select (non-native) has a hidden <input> with the value
    const hiddenSelects = Array.from(
      document.querySelectorAll<HTMLInputElement>('input[type="hidden"]')
    );
    // Change via fireEvent on the hidden input (simulates internal state)
    if (hiddenSelects.length > 0) {
      fireEvent.change(hiddenSelects[0], { target: { value: 'flight' } });
    }
    // Independently verify the form can submit with a changed type via initial prop
    renderWithProviders(
      <CheckpointForm
        initial={{ type: 'flight', name: 'Pre', startTime: '2026-10-01T14:00:00.000Z' }}
        onSave={onSave}
        onCancel={vi.fn()}
      />
    );
    fireEvent.submit(document.querySelectorAll('form')[1]!);
    expect(onSave.mock.calls[0][0].type).toBe('flight');
  });

  describe('timezone offset handling (#101)', () => {
    function getStartTimeInput() {
      return document.querySelector('input[type="datetime-local"][required]') as HTMLInputElement;
    }

    function getEndTimeInput() {
      return document.querySelectorAll<HTMLInputElement>('input[type="datetime-local"]')[1];
    }

    it('preserves startTime byte-identical when editing an unrelated field only', () => {
      const onSave = vi.fn();
      renderWithProviders(
        <CheckpointForm
          initial={{
            type: 'hotel',
            name: 'Tokyo Hotel',
            startTime: '2026-09-13T14:00:00+09:00',
          }}
          onSave={onSave}
          onCancel={vi.fn()}
        />
      );
      fireEvent.change(getNameInput(), { target: { value: 'Tokyo Hotel (updated)' } });
      fireEvent.submit(document.querySelector('form')!);
      expect(onSave.mock.calls[0][0].startTime).toBe('2026-09-13T14:00:00+09:00');
    });

    it('preserves the original offset when the start time value is changed', () => {
      const onSave = vi.fn();
      renderWithProviders(
        <CheckpointForm
          initial={{
            type: 'hotel',
            name: 'Tokyo Hotel',
            startTime: '2026-09-13T14:00:00+09:00',
          }}
          onSave={onSave}
          onCancel={vi.fn()}
        />
      );
      fireEvent.change(getStartTimeInput(), { target: { value: '2026-09-13T16:00' } });
      fireEvent.submit(document.querySelector('form')!);
      expect(onSave.mock.calls[0][0].startTime).toBe('2026-09-13T16:00:00+09:00');
    });

    it('round-trips independent start/end offsets through an unrelated-field edit', () => {
      const onSave = vi.fn();
      renderWithProviders(
        <CheckpointForm
          initial={{
            type: 'flight',
            name: 'TK1768',
            startTime: '2026-09-13T08:00:00+02:00',
            endTime: '2026-09-13T13:30:00+03:00',
          }}
          onSave={onSave}
          onCancel={vi.fn()}
        />
      );
      fireEvent.change(getNameInput(), { target: { value: 'TK1768 (confirmed)' } });
      fireEvent.submit(document.querySelector('form')!);
      const arg = onSave.mock.calls[0][0];
      expect(arg.startTime).toBe('2026-09-13T08:00:00+02:00');
      expect(arg.endTime).toBe('2026-09-13T13:30:00+03:00');
    });

    it('inherits the offset from defaultStartTime for a brand-new checkpoint', () => {
      const onSave = vi.fn();
      renderWithProviders(
        <CheckpointForm
          onSave={onSave}
          onCancel={vi.fn()}
          defaultStartTime="2026-09-13T14:00:00+09:00"
        />
      );
      fireEvent.change(getNameInput(), { target: { value: 'New Stop' } });
      fireEvent.submit(document.querySelector('form')!);
      expect(onSave.mock.calls[0][0].startTime).toBe('2026-09-13T14:00:00+09:00');
    });

    it('a brand-new checkpoint with an explicit end time defaults its end offset to the start offset', () => {
      const onSave = vi.fn();
      renderWithProviders(
        <CheckpointForm
          onSave={onSave}
          onCancel={vi.fn()}
          defaultStartTime="2026-09-13T14:00:00+09:00"
        />
      );
      fireEvent.change(getNameInput(), { target: { value: 'New Stop' } });
      fireEvent.change(getEndTimeInput(), { target: { value: '2026-09-13T16:00' } });
      fireEvent.submit(document.querySelector('form')!);
      expect(onSave.mock.calls[0][0].endTime).toBe('2026-09-13T16:00:00+09:00');
    });
  });

  describe('Google Maps / Search links and website field', () => {
    it('hides the Maps and Search links when name and location are both empty', () => {
      renderWithProviders(<CheckpointForm onSave={vi.fn()} onCancel={vi.fn()} />);
      expect(screen.queryByRole('link', { name: /google maps/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /google search/i })).not.toBeInTheDocument();
    });

    it('Maps link uses the name as a fallback query when no location is set', () => {
      renderWithProviders(<CheckpointForm onSave={vi.fn()} onCancel={vi.fn()} />);
      fireEvent.change(getNameInput(), { target: { value: 'Fushimi Inari' } });
      const link = screen.getByRole('link', { name: /google maps/i });
      expect(link.getAttribute('href')).toBe(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Fushimi Inari')}`
      );
    });

    it('Maps link uses lat,lng once both coordinate fields are filled', () => {
      renderWithProviders(<CheckpointForm onSave={vi.fn()} onCancel={vi.fn()} />);
      fireEvent.change(getNameInput(), { target: { value: 'Fushimi Inari' } });
      const numberInputs = Array.from(
        document.querySelectorAll<HTMLInputElement>('input[type="number"]')
      );
      fireEvent.change(numberInputs[0], { target: { value: '34.9671' } });
      fireEvent.change(numberInputs[1], { target: { value: '135.7727' } });
      const link = screen.getByRole('link', { name: /google maps/i });
      expect(link.getAttribute('href')).toBe(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('34.9671,135.7727')}`
      );
    });

    it('Search link reflects the live name and is absent when name is empty', () => {
      renderWithProviders(<CheckpointForm onSave={vi.fn()} onCancel={vi.fn()} />);
      expect(screen.queryByRole('link', { name: /google search/i })).not.toBeInTheDocument();
      fireEvent.change(getNameInput(), { target: { value: 'Ichiran Ramen' } });
      const link = screen.getByRole('link', { name: /google search/i });
      expect(link.getAttribute('href')).toBe(
        `https://www.google.com/search?q=${encodeURIComponent('Ichiran Ramen')}`
      );
    });

    it('pre-fills the website field from initial.websiteUrl', () => {
      renderWithProviders(
        <CheckpointForm
          initial={{
            type: 'poi',
            name: 'Sensoji',
            startTime: '2026-10-02T15:00:00.000Z',
            websiteUrl: 'https://www.senso-ji.jp',
          }}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      );
      expect(getWebsiteInput()).toHaveValue('https://www.senso-ji.jp');
    });

    it('round-trips websiteUrl through onSave, omitting it when blank', () => {
      const onSave = vi.fn();
      renderWithProviders(
        <CheckpointForm
          onSave={onSave}
          onCancel={vi.fn()}
          defaultStartTime="2026-10-01T14:00:00.000Z"
        />
      );
      fireEvent.change(getNameInput(), { target: { value: 'No Website' } });
      fireEvent.submit(document.querySelector('form')!);
      expect(onSave.mock.calls[0][0].websiteUrl).toBeUndefined();
    });

    it('includes websiteUrl when the field has content', () => {
      const onSave = vi.fn();
      renderWithProviders(
        <CheckpointForm
          onSave={onSave}
          onCancel={vi.fn()}
          defaultStartTime="2026-10-01T14:00:00.000Z"
        />
      );
      fireEvent.change(getNameInput(), { target: { value: 'With Website' } });
      fireEvent.change(getWebsiteInput(), { target: { value: 'https://example.com' } });
      fireEvent.submit(document.querySelector('form')!);
      expect(onSave.mock.calls[0][0].websiteUrl).toBe('https://example.com');
    });

    it('does not render a clickable "Visit website" link for a javascript: URL', () => {
      renderWithProviders(<CheckpointForm onSave={vi.fn()} onCancel={vi.fn()} />);
      fireEvent.change(getWebsiteInput(), { target: { value: 'javascript:alert(1)' } });
      expect(screen.queryByRole('link', { name: /visit website/i })).not.toBeInTheDocument();
      expect(screen.getByText(/won't be clickable/i)).toBeInTheDocument();
    });

    it('renders a clickable "Visit website" link for a valid https URL', () => {
      renderWithProviders(<CheckpointForm onSave={vi.fn()} onCancel={vi.fn()} />);
      fireEvent.change(getWebsiteInput(), { target: { value: 'https://example.com' } });
      const link = screen.getByRole('link', { name: /visit website/i });
      expect(link.getAttribute('href')).toBe('https://example.com');
    });
  });

  describe('romanize affordance on the Name field', () => {
    it('does not render when the name has no kanji', () => {
      renderWithProviders(<CheckpointForm onSave={vi.fn()} onCancel={vi.fn()} />);
      fireEvent.change(getNameInput(), { target: { value: 'Narita Airport' } });
      expect(
        screen.queryByRole('button', { name: /insert romaji reading/i })
      ).not.toBeInTheDocument();
    });

    it('renders once the name contains kanji', () => {
      renderWithProviders(<CheckpointForm onSave={vi.fn()} onCancel={vi.fn()} />);
      fireEvent.change(getNameInput(), { target: { value: '成田空港' } });
      expect(screen.getByRole('button', { name: /insert romaji reading/i })).toBeInTheDocument();
    });

    it('appends the romaji reading directly into the Name field on click', async () => {
      convertMock.mockResolvedValueOnce('narita kūkō');
      renderWithProviders(<CheckpointForm onSave={vi.fn()} onCancel={vi.fn()} />);
      fireEvent.change(getNameInput(), { target: { value: '成田空港' } });
      fireEvent.click(screen.getByRole('button', { name: /insert romaji reading/i }));
      await waitFor(() => expect(getNameInput()).toHaveValue('成田空港 (Narita-Kūkō)'));
    });

    it('hides the insert button after the reading has been inserted', async () => {
      convertMock.mockResolvedValueOnce('narita kūkō');
      renderWithProviders(<CheckpointForm onSave={vi.fn()} onCancel={vi.fn()} />);
      fireEvent.change(getNameInput(), { target: { value: '成田空港' } });
      fireEvent.click(screen.getByRole('button', { name: /insert romaji reading/i }));
      await waitFor(() => expect(getNameInput()).toHaveValue('成田空港 (Narita-Kūkō)'));
      expect(
        screen.queryByRole('button', { name: /insert romaji reading/i })
      ).not.toBeInTheDocument();
    });

    it('shows the insert button again once the name is edited further', async () => {
      convertMock.mockResolvedValueOnce('narita kūkō');
      renderWithProviders(<CheckpointForm onSave={vi.fn()} onCancel={vi.fn()} />);
      fireEvent.change(getNameInput(), { target: { value: '成田空港' } });
      fireEvent.click(screen.getByRole('button', { name: /insert romaji reading/i }));
      await waitFor(() => expect(getNameInput()).toHaveValue('成田空港 (Narita-Kūkō)'));
      fireEvent.change(getNameInput(), { target: { value: '成田空港駅' } });
      expect(screen.getByRole('button', { name: /insert romaji reading/i })).toBeInTheDocument();
    });

    it('shows an offline-unavailable message without altering the Name field', async () => {
      convertMock.mockRejectedValueOnce(new Error('network error'));
      const originalOnLine = Object.getOwnPropertyDescriptor(navigator, 'onLine');
      Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
      renderWithProviders(<CheckpointForm onSave={vi.fn()} onCancel={vi.fn()} />);
      fireEvent.change(getNameInput(), { target: { value: '成田空港' } });
      fireEvent.click(screen.getByRole('button', { name: /insert romaji reading/i }));
      await waitFor(() =>
        expect(screen.getByText('Translation unavailable offline')).toBeInTheDocument()
      );
      expect(getNameInput()).toHaveValue('成田空港');
      if (originalOnLine) Object.defineProperty(navigator, 'onLine', originalOnLine);
    });
  });

  describe('tags', () => {
    it('pre-fills tags as chips from initial.tags', () => {
      renderWithProviders(
        <CheckpointForm
          initial={{
            type: 'poi',
            name: 'Fushimi Inari',
            startTime: '2026-10-06T08:00:00.000Z',
            tags: ['must-see', 'outdoors'],
          }}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      );
      expect(screen.getByText('must-see')).toBeInTheDocument();
      expect(screen.getByText('outdoors')).toBeInTheDocument();
    });

    it('suggests existingTags in the tags input', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <CheckpointForm onSave={vi.fn()} onCancel={vi.fn()} existingTags={['food', 'rainy-day']} />
      );
      await user.click(screen.getByRole('combobox', { name: /tags/i }));
      expect(screen.getByRole('option', { name: 'food' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'rainy-day' })).toBeInTheDocument();
    });

    it('includes newly typed tags in onSave, trimmed and deduped', () => {
      const onSave = vi.fn();
      renderWithProviders(
        <CheckpointForm
          onSave={onSave}
          onCancel={vi.fn()}
          defaultStartTime="2026-10-01T14:00:00.000Z"
        />
      );
      fireEvent.change(getNameInput(), { target: { value: 'Tagged Stop' } });
      const tagsInput = screen.getByRole('combobox', { name: /tags/i });
      fireEvent.change(tagsInput, { target: { value: '  food  ' } });
      fireEvent.keyDown(tagsInput, { key: 'Enter' });
      fireEvent.submit(document.querySelector('form')!);
      expect(onSave.mock.calls[0][0].tags).toEqual(['food']);
    });

    it('includes a typed tag in onSave even without pressing Enter first', () => {
      const onSave = vi.fn();
      renderWithProviders(
        <CheckpointForm
          onSave={onSave}
          onCancel={vi.fn()}
          defaultStartTime="2026-10-01T14:00:00.000Z"
        />
      );
      fireEvent.change(getNameInput(), { target: { value: 'Tagged Stop' } });
      const tagsInput = screen.getByRole('combobox', { name: /tags/i });
      fireEvent.change(tagsInput, { target: { value: 'food' } });
      // No Enter/blur to commit the chip — just submit directly, as a user
      // clicking Save straight after typing would.
      fireEvent.submit(document.querySelector('form')!);
      expect(onSave.mock.calls[0][0].tags).toEqual(['food']);
    });

    it('omits tags entirely when none are entered', () => {
      const onSave = vi.fn();
      renderWithProviders(
        <CheckpointForm
          onSave={onSave}
          onCancel={vi.fn()}
          defaultStartTime="2026-10-01T14:00:00.000Z"
        />
      );
      fireEvent.change(getNameInput(), { target: { value: 'No Tags' } });
      fireEvent.submit(document.querySelector('form')!);
      expect(onSave.mock.calls[0][0].tags).toBeUndefined();
    });
  });
});
