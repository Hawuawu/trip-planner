import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PoiPopup } from './PoiPopup';
import type { Poi } from './poi';

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

vi.mock('react-map-gl/maplibre', () => ({
  Popup: ({ children, onClose }: { children: React.ReactNode; onClose: () => void }) => (
    <div data-testid="popup">
      {children}
      <button data-testid="popup-close" onClick={onClose}>
        close
      </button>
    </div>
  ),
}));

function makePoi(overrides: Partial<Poi> = {}): Poi {
  return {
    name: 'Sensō-ji',
    location: { lat: 35.71, lng: 139.79 },
    ...overrides,
  };
}

beforeEach(() => {
  convertMock.mockReset();
});

describe('PoiPopup', () => {
  it('renders the POI name and an "add as alternative" button', () => {
    render(<PoiPopup poi={makePoi()} onAddAsAlternative={() => {}} onClose={() => {}} />);
    expect(screen.getByText('Sensō-ji')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Sensō-ji as alternative' })).toBeInTheDocument();
  });

  it('calls onAddAsAlternative with the current name', () => {
    const onAddAsAlternative = vi.fn();
    render(<PoiPopup poi={makePoi()} onAddAsAlternative={onAddAsAlternative} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Sensō-ji as alternative' }));
    expect(onAddAsAlternative).toHaveBeenCalledWith('Sensō-ji');
  });

  it('calls onClose when the popup close action fires', () => {
    const onClose = vi.fn();
    render(<PoiPopup poi={makePoi()} onAddAsAlternative={() => {}} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('popup-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not show a romanize button when the name has no kanji', () => {
    render(
      <PoiPopup
        poi={makePoi({ name: 'Sensoji Temple' })}
        onAddAsAlternative={() => {}}
        onClose={() => {}}
      />
    );
    expect(
      screen.queryByRole('button', { name: /insert romaji reading/i })
    ).not.toBeInTheDocument();
  });

  it('shows a romanize button when the name contains kanji', () => {
    render(
      <PoiPopup
        poi={makePoi({ name: '浅草寺' })}
        onAddAsAlternative={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.getByRole('button', { name: /insert romaji reading/i })).toBeInTheDocument();
  });

  it('appends the romaji reading to the displayed name and to what is added as an alternative', async () => {
    convertMock.mockResolvedValueOnce('sensō ji');
    const onAddAsAlternative = vi.fn();
    render(
      <PoiPopup
        poi={makePoi({ name: '浅草寺' })}
        onAddAsAlternative={onAddAsAlternative}
        onClose={() => {}}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /insert romaji reading/i }));
    await waitFor(() => expect(screen.getByText('浅草寺 (Sensō-Ji)')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Add 浅草寺 (Sensō-Ji) as alternative' }));
    expect(onAddAsAlternative).toHaveBeenCalledWith('浅草寺 (Sensō-Ji)');
  });

  it('hides the romanize button once a reading has been inserted', async () => {
    convertMock.mockResolvedValueOnce('sensō ji');
    render(
      <PoiPopup
        poi={makePoi({ name: '浅草寺' })}
        onAddAsAlternative={() => {}}
        onClose={() => {}}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /insert romaji reading/i }));
    await waitFor(() => expect(screen.getByText('浅草寺 (Sensō-Ji)')).toBeInTheDocument());
    expect(
      screen.queryByRole('button', { name: /insert romaji reading/i })
    ).not.toBeInTheDocument();
  });

  it('shows an offline-unavailable message without altering the displayed name', async () => {
    convertMock.mockRejectedValueOnce(new Error('network error'));
    const originalOnLine = Object.getOwnPropertyDescriptor(navigator, 'onLine');
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });

    render(
      <PoiPopup
        poi={makePoi({ name: '浅草寺' })}
        onAddAsAlternative={() => {}}
        onClose={() => {}}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /insert romaji reading/i }));

    await waitFor(() =>
      expect(screen.getByText('Translation unavailable offline')).toBeInTheDocument()
    );
    expect(screen.getByText('浅草寺')).toBeInTheDocument();

    if (originalOnLine) Object.defineProperty(navigator, 'onLine', originalOnLine);
  });
});
