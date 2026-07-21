import { useRef, useState } from 'react';
import { Box, useMediaQuery, useTheme } from '@mui/material';
import { useMap } from 'react-map-gl/maplibre';
import {
  BEARING_SENSITIVITY,
  MAX_PITCH,
  PITCH_SENSITIVITY,
  RESET_DURATION_MS,
} from './mapConstants';

function clampPitch(pitch: number): number {
  return Math.min(MAX_PITCH, Math.max(0, pitch));
}

export function MapOrientationBall() {
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'));
  const { current: map } = useMap();

  const [bearing, setBearing] = useState(0);
  const [pitch, setPitch] = useState(0);
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startBearing: number;
    startPitch: number;
  } | null>(null);

  const size = isPhone ? 68 : 96;
  const radius = size / 2;
  const innerRadius = radius - 10;

  function handlePointerDown(e: React.PointerEvent<SVGSVGElement>) {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startBearing: bearing,
      startPitch: pitch,
    };
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!drag.current || drag.current.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.current.startX;
    const dy = e.clientY - drag.current.startY;
    const nextBearing = drag.current.startBearing + dx * BEARING_SENSITIVITY;
    const nextPitch = clampPitch(drag.current.startPitch - dy * PITCH_SENSITIVITY);
    setBearing(nextBearing);
    setPitch(nextPitch);
    map?.jumpTo({ bearing: nextBearing, pitch: nextPitch });
  }

  function handlePointerUp(e: React.PointerEvent<SVGSVGElement>) {
    if (drag.current?.pointerId === e.pointerId) {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
      drag.current = null;
    }
  }

  function handleDoubleClick() {
    setBearing(0);
    setPitch(0);
    map?.easeTo({ bearing: 0, pitch: 0, duration: RESET_DURATION_MS });
  }

  const pitchScale = Math.cos((pitch * Math.PI) / 180);

  return (
    <Box sx={{ width: size, height: size, touchAction: 'none' }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label="Map bearing and pitch control — drag to rotate and tilt, double-click to reset"
        style={{ cursor: 'grab', touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      >
        <circle
          cx={radius}
          cy={radius}
          r={radius - 1}
          fill={theme.palette.background.paper}
          stroke={theme.palette.divider}
          strokeWidth={2}
        />
        <ellipse
          cx={radius}
          cy={radius}
          rx={innerRadius}
          ry={Math.max(innerRadius * pitchScale, 2)}
          fill="none"
          stroke={theme.palette.text.secondary}
          strokeWidth={1}
        />
        <g transform={`rotate(${bearing} ${radius} ${radius})`}>
          <polygon
            points={`${radius - 5},${radius - innerRadius + 10} ${radius + 5},${radius - innerRadius + 10} ${radius},${radius - innerRadius - 4}`}
            fill={theme.palette.secondary.main}
          />
          <text
            x={radius}
            y={radius - innerRadius + 22}
            textAnchor="middle"
            fontSize={10}
            fill={theme.palette.text.secondary}
          >
            N
          </text>
        </g>
      </svg>
    </Box>
  );
}
