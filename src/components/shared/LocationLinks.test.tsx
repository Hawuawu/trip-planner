import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LocationLinks } from './LocationLinks';

describe('LocationLinks', () => {
  it('renders a Maps link using the location when provided', () => {
    render(
      <LocationLinks location={{ lat: 34.9, lng: 135.77 }} mapsFallbackQuery="" name="Fushimi" />
    );
    const link = screen.getByText('Google Maps').closest('a');
    expect(link?.getAttribute('href')).toContain('34.9%2C135.77');
  });

  it('falls back to the query string when there is no location', () => {
    render(<LocationLinks location={undefined} mapsFallbackQuery="Kyoto" name="Fushimi" />);
    const link = screen.getByText('Google Maps').closest('a');
    expect(link?.getAttribute('href')).toContain('Kyoto');
  });

  it('renders the Search link only when name is non-empty', () => {
    const { rerender } = render(
      <LocationLinks location={undefined} mapsFallbackQuery="" name="Fushimi" />
    );
    expect(screen.getByText('Google Search')).toBeInTheDocument();

    rerender(<LocationLinks location={undefined} mapsFallbackQuery="" name="" />);
    expect(screen.queryByText('Google Search')).not.toBeInTheDocument();
  });

  it('renders neither link when there is no location, fallback query, or name', () => {
    render(<LocationLinks location={undefined} mapsFallbackQuery="" name="" />);
    expect(screen.queryByText('Google Maps')).not.toBeInTheDocument();
    expect(screen.queryByText('Google Search')).not.toBeInTheDocument();
  });
});
