import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

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

// Save and restore the real navigator.onLine descriptor between tests.
const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, 'onLine');

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => value,
  });
}

afterEach(() => {
  if (originalDescriptor) {
    Object.defineProperty(navigator, 'onLine', originalDescriptor);
  } else {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
  }
  convertMock.mockReset();
  vi.resetModules();
});

describe('useKanjiReading', () => {
  it('reaches a ready state with the converted reading on success', async () => {
    setOnline(true);
    convertMock.mockResolvedValueOnce('Narita Kūkō');
    const { useKanjiReading } = await import('../hooks/useKanjiReading');
    const { result } = renderHook(() => useKanjiReading());

    act(() => {
      result.current.reveal('成田空港');
    });

    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    expect(result.current.state).toEqual({ status: 'ready', reading: 'Narita Kūkō' });
  });

  it('reaches unavailable-offline when conversion fails while offline', async () => {
    setOnline(false);
    convertMock.mockRejectedValueOnce(new Error('network error'));
    const { useKanjiReading } = await import('../hooks/useKanjiReading');
    const { result } = renderHook(() => useKanjiReading());

    act(() => {
      result.current.reveal('成田空港');
    });

    await waitFor(() => expect(result.current.state.status).toBe('unavailable-offline'));
  });

  it('reaches an error state when conversion fails while online', async () => {
    setOnline(true);
    convertMock.mockRejectedValueOnce(new Error('boom'));
    const { useKanjiReading } = await import('../hooks/useKanjiReading');
    const { result } = renderHook(() => useKanjiReading());

    act(() => {
      result.current.reveal('成田空港');
    });

    await waitFor(() => expect(result.current.state.status).toBe('error'));
  });
});
