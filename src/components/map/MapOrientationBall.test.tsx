import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MapOrientationBall } from './MapOrientationBall';
import { MAX_PITCH } from './mapConstants';

const jumpTo = vi.fn();
const easeTo = vi.fn();

vi.mock('react-map-gl/maplibre', () => ({
  useMap: () => ({ current: { jumpTo, easeTo } }),
}));

beforeEach(() => {
  jumpTo.mockClear();
  easeTo.mockClear();
});

function drag(el: Element, from: { x: number; y: number }, to: { x: number; y: number }) {
  fireEvent.pointerDown(el, { pointerId: 1, clientX: from.x, clientY: from.y });
  fireEvent.pointerMove(el, { pointerId: 1, clientX: to.x, clientY: to.y });
}

describe('MapOrientationBall', () => {
  it('renders an accessible drag surface', () => {
    render(<MapOrientationBall />);
    expect(screen.getByRole('img', { name: /bearing and pitch/i })).toBeInTheDocument();
  });

  it('rotates bearing proportionally to horizontal drag distance', () => {
    render(<MapOrientationBall />);
    const ball = screen.getByRole('img');
    drag(ball, { x: 100, y: 100 }, { x: 150, y: 100 });
    expect(jumpTo).toHaveBeenLastCalledWith(expect.objectContaining({ bearing: 30 }));
  });

  it('increases pitch when dragging upward', () => {
    render(<MapOrientationBall />);
    const ball = screen.getByRole('img');
    drag(ball, { x: 100, y: 100 }, { x: 100, y: 60 });
    expect(jumpTo).toHaveBeenLastCalledWith(expect.objectContaining({ pitch: 14 }));
  });

  it('clamps pitch at MAX_PITCH on a large upward drag', () => {
    render(<MapOrientationBall />);
    const ball = screen.getByRole('img');
    drag(ball, { x: 100, y: 100 }, { x: 100, y: -500 });
    expect(jumpTo).toHaveBeenLastCalledWith(expect.objectContaining({ pitch: MAX_PITCH }));
  });

  it('clamps pitch at 0 on a downward drag', () => {
    render(<MapOrientationBall />);
    const ball = screen.getByRole('img');
    drag(ball, { x: 100, y: 100 }, { x: 100, y: 500 });
    expect(jumpTo).toHaveBeenLastCalledWith(expect.objectContaining({ pitch: 0 }));
  });

  it('ignores pointermove from an unrelated pointerId', () => {
    render(<MapOrientationBall />);
    const ball = screen.getByRole('img');
    fireEvent.pointerDown(ball, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(ball, { pointerId: 2, clientX: 200, clientY: 100 });
    expect(jumpTo).not.toHaveBeenCalled();
  });

  it('stops applying moves once the pointer is released', () => {
    render(<MapOrientationBall />);
    const ball = screen.getByRole('img');
    drag(ball, { x: 100, y: 100 }, { x: 150, y: 100 });
    fireEvent.pointerUp(ball, { pointerId: 1 });
    jumpTo.mockClear();

    fireEvent.pointerMove(ball, { pointerId: 1, clientX: 200, clientY: 100 });
    expect(jumpTo).not.toHaveBeenCalled();
  });

  it('ignores pointerup from an unrelated pointerId and keeps the drag active', () => {
    render(<MapOrientationBall />);
    const ball = screen.getByRole('img');
    fireEvent.pointerDown(ball, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(ball, { pointerId: 2 });
    jumpTo.mockClear();

    fireEvent.pointerMove(ball, { pointerId: 1, clientX: 150, clientY: 100 });
    expect(jumpTo).toHaveBeenCalled();
  });

  it('resets bearing and pitch via easeTo on double-click', () => {
    render(<MapOrientationBall />);
    const ball = screen.getByRole('img');
    drag(ball, { x: 100, y: 100 }, { x: 150, y: 60 });
    fireEvent.doubleClick(ball);
    expect(easeTo).toHaveBeenCalledWith(expect.objectContaining({ bearing: 0, pitch: 0 }));
  });
});
