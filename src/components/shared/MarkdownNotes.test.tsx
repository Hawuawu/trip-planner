import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material';
import { theme } from '../../theme';
import { MarkdownNotes } from './MarkdownNotes';

function setup(notes: string, overrides: Partial<React.ComponentProps<typeof MarkdownNotes>> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <MarkdownNotes notes={notes} {...overrides} />
    </ThemeProvider>
  );
}

describe('MarkdownNotes', () => {
  it('renders **bold** markdown as a real <strong> element', () => {
    setup('this is **bold** text');
    const strong = screen.getByText('bold');
    expect(strong.tagName).toBe('STRONG');
  });

  it('renders a markdown list as <ul><li>', () => {
    setup('- first\n- second');
    const list = screen.getByRole('list');
    expect(list.tagName).toBe('UL');
    expect(screen.getByText('first').closest('li')).not.toBeNull();
    expect(screen.getByText('second').closest('li')).not.toBeNull();
  });

  it('forces target="_blank" and rel="noopener noreferrer" on links', () => {
    setup('[reservation](https://example.com/booking)');
    const link = screen.getByRole('link', { name: 'reservation' });
    expect(link).toHaveAttribute('href', 'https://example.com/booking');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('strips a javascript:-scheme link href', () => {
    const { container } = setup('[bad](javascript:alert(1))');
    const link = container.querySelector('a');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).not.toMatch(/^javascript:/);
  });

  it('strips a javascript:-scheme image src', () => {
    setup('![bad](javascript:alert(1))');
    const image = screen.getByRole('img', { name: 'bad' });
    expect(image.getAttribute('src')).not.toMatch(/^javascript:/);
  });

  it('accepts a variant and sx passthrough without breaking rendering', () => {
    setup('plain text', { variant: 'caption', sx: { color: 'primary.main' } });
    expect(screen.getByText('plain text')).toBeInTheDocument();
  });

  it('renders a trip:// internal link as clickable and fires onInternalLink on click', async () => {
    const onInternalLink = vi.fn();
    setup('[Narita Airport](trip://checkpoint/cp-1)', { onInternalLink });
    const button = screen.getByRole('button', { name: 'Narita Airport' });
    await userEvent.click(button);
    expect(onInternalLink).toHaveBeenCalledWith('checkpoint', 'cp-1');
  });

  it('strips a trip:// href when onInternalLink is not provided (unchanged legacy behavior)', () => {
    const { container } = setup('[Narita Airport](trip://checkpoint/cp-1)');
    expect(screen.queryByRole('button', { name: 'Narita Airport' })).toBeNull();
    const link = container.querySelector('a');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).not.toMatch(/^trip:\/\//);
  });
});
