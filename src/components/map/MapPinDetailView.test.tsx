import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MapPinDetailView } from './MapPinDetailView';

describe('MapPinDetailView', () => {
  it('renders name, type icon, location label, and notes', () => {
    render(
      <MapPinDetailView
        name="Fushimi Inari"
        type="poi"
        location={{ lat: 34.9, lng: 135.77, label: 'Kyoto' }}
        notes="Great **views**"
        onEdit={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.getByText('Fushimi Inari')).toBeInTheDocument();
    expect(screen.getByText('Kyoto')).toBeInTheDocument();
    expect(screen.getByText('views')).toBeInTheDocument();
  });

  it('shows a "No notes." fallback when there are no notes', () => {
    render(
      <MapPinDetailView name="Fushimi Inari" type="poi" onEdit={() => {}} onClose={() => {}} />
    );
    expect(screen.getByText('No notes.')).toBeInTheDocument();
  });

  it('renders Google Maps/Search links', () => {
    render(
      <MapPinDetailView
        name="Fushimi Inari"
        type="poi"
        location={{ lat: 34.9, lng: 135.77 }}
        onEdit={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.getByText('Google Maps')).toBeInTheDocument();
    expect(screen.getByText('Google Search')).toBeInTheDocument();
  });

  it('renders a website link only for a valid http(s) URL', () => {
    const { rerender } = render(
      <MapPinDetailView
        name="Fushimi Inari"
        type="poi"
        websiteUrl="https://example.com"
        onEdit={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.getByText('Visit website')).toBeInTheDocument();

    rerender(
      <MapPinDetailView
        name="Fushimi Inari"
        type="poi"
        websiteUrl="not-a-url"
        onEdit={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.queryByText('Visit website')).not.toBeInTheDocument();
  });

  it('calls onEdit and onClose from their respective buttons', () => {
    const onEdit = vi.fn();
    const onClose = vi.fn();
    render(<MapPinDetailView name="Fushimi Inari" type="poi" onEdit={onEdit} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(onEdit).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
