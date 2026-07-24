import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { AlternativeForm } from '../components/alternatives/AlternativeForm';
import { renderWithProviders } from './helpers';

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

function getNameInput() {
  return screen.getByRole('textbox', { name: 'Name' });
}

describe('AlternativeForm romanize affordance', () => {
  it('does not render when the name has no kanji', () => {
    renderWithProviders(<AlternativeForm onSave={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(getNameInput(), { target: { value: 'Narita Airport' } });
    expect(
      screen.queryByRole('button', { name: /insert romaji reading/i })
    ).not.toBeInTheDocument();
  });

  it('renders once the name contains kanji', () => {
    renderWithProviders(<AlternativeForm onSave={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(getNameInput(), { target: { value: '銀の鈴幼稚園' } });
    expect(screen.getByRole('button', { name: /insert romaji reading/i })).toBeInTheDocument();
  });

  it('appends the romaji reading directly into the Name field on click', async () => {
    convertMock.mockResolvedValueOnce('gin no suzu yōchien');
    renderWithProviders(<AlternativeForm onSave={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(getNameInput(), { target: { value: '銀の鈴幼稚園' } });
    fireEvent.click(screen.getByRole('button', { name: /insert romaji reading/i }));
    await waitFor(() => expect(getNameInput()).toHaveValue('銀の鈴幼稚園 (Gin-No-Suzu-Yōchien)'));
  });

  it('hides the insert button after the reading has been inserted', async () => {
    convertMock.mockResolvedValueOnce('gin no suzu yōchien');
    renderWithProviders(<AlternativeForm onSave={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(getNameInput(), { target: { value: '銀の鈴幼稚園' } });
    fireEvent.click(screen.getByRole('button', { name: /insert romaji reading/i }));
    await waitFor(() => expect(getNameInput()).toHaveValue('銀の鈴幼稚園 (Gin-No-Suzu-Yōchien)'));
    expect(
      screen.queryByRole('button', { name: /insert romaji reading/i })
    ).not.toBeInTheDocument();
  });
});
