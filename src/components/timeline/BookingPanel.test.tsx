import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BookingPanel } from './BookingPanel';
import { renderWithProviders, resetStores } from '../../test/helpers';
import { useTripStore } from '../../store/tripStore';
import type { Booking } from '../../types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BOOKING: Booking = {
  id: 'bk-1',
  provider: 'Japan Airlines',
  confirmationNumber: 'JL12345',
  notes: 'Window seat reserved',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function setupStore(overrides: {
  bookings?: Booking[];
  addBooking?: ReturnType<typeof vi.fn>;
  updateCheckpoint?: ReturnType<typeof vi.fn>;
}) {
  const addBookingMock = overrides.addBooking ?? vi.fn().mockResolvedValue({
    id: 'bk-new',
    provider: 'ANA',
    confirmationNumber: 'ANA-001',
  });
  const updateCheckpointMock = overrides.updateCheckpoint ?? vi.fn().mockResolvedValue(undefined);

  useTripStore.setState({
    tripId: 'trip-1',
    bookings: overrides.bookings ?? [],
    addBooking: addBookingMock,
    updateCheckpoint: updateCheckpointMock,
  });

  return { addBookingMock, updateCheckpointMock };
}

// Gets the "Add booking" trigger button (outside any dialog)
function getAddBookingButton() {
  return screen.getByRole('button', { name: /add booking/i });
}

// Gets the Save button inside the dialog
function getSaveButton() {
  const dialog = screen.getByRole('dialog');
  const buttons = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button'));
  return buttons.find((b) => /^save$/i.test(b.textContent?.trim() ?? ''))!;
}

beforeEach(() => {
  resetStores();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BookingPanel', () => {
  it('shows "Add booking" button when no linkedBookingId is set', () => {
    setupStore({});
    renderWithProviders(<BookingPanel checkpointId="cp-1" />);
    expect(getAddBookingButton()).toBeInTheDocument();
  });

  it('does not show "Add booking" button when a booking is linked', () => {
    setupStore({ bookings: [BOOKING] });
    renderWithProviders(<BookingPanel checkpointId="cp-1" linkedBookingId="bk-1" />);
    expect(screen.queryByRole('button', { name: /add booking/i })).not.toBeInTheDocument();
  });

  it('opens the dialog when "Add booking" is clicked', async () => {
    setupStore({});
    const user = userEvent.setup();
    renderWithProviders(<BookingPanel checkpointId="cp-1" />);
    await user.click(getAddBookingButton());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // Dialog title is rendered as a heading
    expect(screen.getByRole('heading', { name: /add booking/i })).toBeInTheDocument();
  });

  it('does not call addBooking when provider is empty on submit', async () => {
    const { addBookingMock } = setupStore({});
    const user = userEvent.setup();
    renderWithProviders(<BookingPanel checkpointId="cp-1" />);
    await user.click(getAddBookingButton());

    // Fill only confirmationNumber, leave provider empty
    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[1], { target: { value: 'CONF-123' } });

    // Save button should be disabled when provider is empty
    const saveBtn = getSaveButton();
    expect(saveBtn).toBeDisabled();
    expect(addBookingMock).not.toHaveBeenCalled();
  });

  it('does not call addBooking when confirmationNumber is empty on submit', async () => {
    const { addBookingMock } = setupStore({});
    const user = userEvent.setup();
    renderWithProviders(<BookingPanel checkpointId="cp-1" />);
    await user.click(getAddBookingButton());

    // Fill only provider, leave confirmationNumber empty
    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: 'Japan Airlines' } });

    // Save button should be disabled when confirmationNumber is empty
    const saveBtn = getSaveButton();
    expect(saveBtn).toBeDisabled();
    expect(addBookingMock).not.toHaveBeenCalled();
  });

  it('calls addBooking then updateCheckpoint with the new id on valid submit', async () => {
    const savedBooking = { id: 'bk-new-1', provider: 'ANA', confirmationNumber: 'ANA-001' };
    const addBookingMock = vi.fn().mockResolvedValue(savedBooking);
    const updateCheckpointMock = vi.fn().mockResolvedValue(undefined);
    setupStore({ addBooking: addBookingMock, updateCheckpoint: updateCheckpointMock });

    const user = userEvent.setup();
    renderWithProviders(<BookingPanel checkpointId="cp-42" />);

    await user.click(getAddBookingButton());

    const inputs = screen.getAllByRole('textbox');
    // provider is first, confirmationNumber is second
    await user.type(inputs[0], 'ANA');
    await user.type(inputs[1], 'ANA-001');

    await user.click(getSaveButton());

    await waitFor(() => {
      expect(addBookingMock).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'ANA', confirmationNumber: 'ANA-001' })
      );
    });

    await waitFor(() => {
      expect(updateCheckpointMock).toHaveBeenCalledWith(
        'cp-42',
        expect.objectContaining({ linkedBookingId: 'bk-new-1' })
      );
    });
  });

  it('shows linked booking provider and confirmationNumber when linkedBookingId is set', () => {
    setupStore({ bookings: [BOOKING] });
    renderWithProviders(<BookingPanel checkpointId="cp-1" linkedBookingId="bk-1" />);
    expect(screen.getByText('Japan Airlines')).toBeInTheDocument();
    expect(screen.getByText('JL12345')).toBeInTheDocument();
  });

  it('shows booking notes when the linked booking has notes', () => {
    setupStore({ bookings: [BOOKING] });
    renderWithProviders(<BookingPanel checkpointId="cp-1" linkedBookingId="bk-1" />);
    expect(screen.getByText('Window seat reserved')).toBeInTheDocument();
  });

  it('"Remove link" button calls updateCheckpoint with linkedBookingId: undefined', async () => {
    const updateCheckpointMock = vi.fn().mockResolvedValue(undefined);
    setupStore({ bookings: [BOOKING], updateCheckpoint: updateCheckpointMock });

    const user = userEvent.setup();
    renderWithProviders(<BookingPanel checkpointId="cp-1" linkedBookingId="bk-1" />);

    await user.click(screen.getByRole('button', { name: /remove link/i }));

    expect(updateCheckpointMock).toHaveBeenCalledWith(
      'cp-1',
      expect.objectContaining({ linkedBookingId: undefined })
    );
  });

  it('closes the dialog when Cancel is clicked', async () => {
    setupStore({});
    const user = userEvent.setup();
    renderWithProviders(<BookingPanel checkpointId="cp-1" />);

    await user.click(getAddBookingButton());
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const dialog = screen.getByRole('dialog');
    const cancelBtn = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button'))
      .find((b) => /^cancel$/i.test(b.textContent?.trim() ?? ''))!;
    await user.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
