import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { YamlImportDialog } from './YamlImportDialog';
import { renderWithProviders } from '../../test/helpers';
import type { YamlValidationError } from '../../data/tripYaml';

interface FakeParsed {
  checkpoints: unknown[];
  alternatives: unknown[];
  errors: YamlValidationError[];
}

async function uploadFile(content: string, fileName = 'checkpoints.yaml') {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /choose yaml file/i }));

  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File([content], fileName, { type: 'text/yaml' });
  Object.defineProperty(input, 'files', { value: [file] });

  await act(async () => {
    input.dispatchEvent(new Event('change'));
    // readUploadedFileText/FileReader resolves asynchronously
    await new Promise((r) => setTimeout(r, 0));
  });
}

afterEach(() => {
  document.querySelectorAll('input[type="file"]').forEach((el) => el.remove());
  vi.restoreAllMocks();
});

describe('YamlImportDialog', () => {
  it('shows a file picker button when nothing has been chosen yet', () => {
    renderWithProviders(
      <YamlImportDialog
        open
        title="Import checkpoints"
        description="Import checkpoints into the current trip."
        onClose={vi.fn()}
        parse={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /choose yaml file/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^import$/i })).not.toBeInTheDocument();
  });

  it('shows the validation error list when the parsed file has errors', async () => {
    const parse = vi.fn((): FakeParsed => ({
      checkpoints: [],
      alternatives: [],
      errors: [{ path: 'checkpoints[0]', message: '"type" must be one of flight, poi' }],
    }));

    renderWithProviders(
      <YamlImportDialog
        open
        title="Import checkpoints"
        description="Import checkpoints into the current trip."
        onClose={vi.fn()}
        parse={parse}
        onConfirm={vi.fn()}
      />
    );

    await uploadFile('checkpoints:\n  - type: bad\n');

    await waitFor(() => {
      expect(parse).toHaveBeenCalledWith('checkpoints:\n  - type: bad\n');
    });
    await waitFor(() => {
      expect(screen.getByText(/1 validation error/i)).toBeInTheDocument();
    });
    expect(screen.getByText('checkpoints[0]')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^import$/i })).not.toBeInTheDocument();
  });

  it('shows a confirm view with item counts when the parsed file is valid', async () => {
    const parse = vi.fn((): FakeParsed => ({
      checkpoints: [{ name: 'Nara Deer Park' }],
      alternatives: [{ name: 'Todai-ji' }, { name: 'Fushimi Inari' }],
      errors: [],
    }));

    renderWithProviders(
      <YamlImportDialog
        open
        title="Import checkpoints"
        description="Import checkpoints into the current trip."
        onClose={vi.fn()}
        parse={parse}
        onConfirm={vi.fn()}
      />
    );

    await uploadFile('checkpoints:\n  - name: Nara Deer Park\n');

    await waitFor(() => {
      expect(screen.getByText(/import 1 checkpoint and 2 alternatives/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /^import$/i })).toBeInTheDocument();
  });

  it('calls onConfirm with the parsed data and closes on success', async () => {
    const parsed: FakeParsed = {
      checkpoints: [{ name: 'Nara Deer Park' }],
      alternatives: [],
      errors: [],
    };
    const parse = vi.fn(() => parsed);
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    renderWithProviders(
      <YamlImportDialog
        open
        title="Import checkpoints"
        description="Import checkpoints into the current trip."
        onClose={onClose}
        parse={parse}
        onConfirm={onConfirm}
      />
    );

    await uploadFile('checkpoints:\n  - name: Nara Deer Park\n');
    await waitFor(() => screen.getByRole('button', { name: /^import$/i }));

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^import$/i }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith(parsed);
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('shows a retry-capable error and does not close when onConfirm rejects', async () => {
    const parsed: FakeParsed = { checkpoints: [{ name: 'X' }], alternatives: [], errors: [] };
    const parse = vi.fn(() => parsed);
    const onConfirm = vi.fn().mockRejectedValue(new Error('createTrip failed'));
    const onClose = vi.fn();

    renderWithProviders(
      <YamlImportDialog
        open
        title="Import trip"
        description="Import a full trip as a new trip."
        onClose={onClose}
        parse={parse}
        onConfirm={onConfirm}
      />
    );

    await uploadFile('name: Trip\ncheckpoints:\n  - name: X\n');
    await waitFor(() => screen.getByRole('button', { name: /^import$/i }));

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^import$/i }));

    await waitFor(() => {
      expect(screen.getByText('createTrip failed')).toBeInTheDocument();
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('resets to the file-picker view when "Choose a different file" is clicked', async () => {
    const parse = vi.fn((): FakeParsed => ({
      checkpoints: [],
      alternatives: [],
      errors: [{ path: 'checkpoints[0]', message: 'bad type' }],
    }));

    renderWithProviders(
      <YamlImportDialog
        open
        title="Import checkpoints"
        description="desc"
        onClose={vi.fn()}
        parse={parse}
        onConfirm={vi.fn()}
      />
    );

    await uploadFile('checkpoints:\n  - type: bad\n');
    await waitFor(() => screen.getByText(/1 validation error/i));

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /choose a different file/i }));

    expect(screen.getByRole('button', { name: /choose yaml file/i })).toBeInTheDocument();
    expect(screen.queryByText(/1 validation error/i)).not.toBeInTheDocument();
  });
});
