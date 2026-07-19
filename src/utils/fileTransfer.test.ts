import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  downloadTextFile,
  readUploadedFileText,
  slugifyFilename,
  useYamlFilePicker,
} from './fileTransfer';

describe('slugifyFilename', () => {
  it('lowercases and hyphenates a trip name', () => {
    expect(slugifyFilename('Japan 2026')).toBe('japan-2026');
  });

  it('strips punctuation and collapses repeated separators', () => {
    expect(slugifyFilename("Maiyun's  Trip: Japan!!")).toBe('maiyun-s-trip-japan');
  });

  it('falls back to the given default when the name is empty or all punctuation', () => {
    expect(slugifyFilename('', 'trip')).toBe('trip');
    expect(slugifyFilename('!!!', 'trip')).toBe('trip');
  });
});

describe('downloadTextFile', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates an object URL, triggers a download link click, then revokes the URL', () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadTextFile('trip.yaml', 'name: Japan 2026', 'text/yaml');

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    vi.unstubAllGlobals();
  });

  it('does not leave the temporary anchor element in the DOM', () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadTextFile('trip.yaml', 'name: Japan 2026');

    expect(document.querySelector('a[download="trip.yaml"]')).toBeNull();
    vi.unstubAllGlobals();
  });
});

describe('readUploadedFileText', () => {
  it('resolves with the file contents as text', async () => {
    const file = new File(['checkpoints: []'], 'checkpoints.yaml', { type: 'text/yaml' });
    const text = await readUploadedFileText(file);
    expect(text).toBe('checkpoints: []');
  });
});

describe('useYamlFilePicker', () => {
  afterEach(() => {
    document.querySelectorAll('input[type="file"]').forEach((el) => el.remove());
    vi.restoreAllMocks();
  });

  it('creates a hidden file input, appends it, and clicks it when invoked', () => {
    const onFile = vi.fn();
    const { result } = renderHook(() => useYamlFilePicker(onFile));

    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});

    act(() => {
      result.current();
    });

    const input = document.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    expect(input?.getAttribute('accept')).toBe('.yaml,.yml');
    expect(clickSpy).toHaveBeenCalledTimes(1);

    clickSpy.mockRestore();
  });

  it('calls onFile with the selected file and removes the input on change', () => {
    const onFile = vi.fn();
    const { result } = renderHook(() => useYamlFilePicker(onFile));
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});

    act(() => {
      result.current();
    });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['checkpoints: []'], 'checkpoints.yaml', { type: 'text/yaml' });
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change'));

    expect(onFile).toHaveBeenCalledWith(file);
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });
});
