import { Marker } from 'react-map-gl/maplibre';
import {
  LOCATION_MARKER_COLOR,
  VIEW_CONE_ANGLE_DEG,
  VIEW_CONE_RADIUS_PX,
  VIEW_CONE_FILL_OPACITY,
  VIEW_CONE_STROKE_OPACITY,
} from './mapConstants';

interface Props {
  position: { lat: number; lng: number } | null;
  heading: number | null;
}

const SIZE = VIEW_CONE_RADIUS_PX * 2;
const CENTER = SIZE / 2;
const DOT_RADIUS = 7;

// Point at `radius` from the marker center, `angleDeg` clockwise from
// straight up — matches compass heading (0 = north/up, 90 = east/right),
// same convention MapOrientationBall's bearing rotation already uses.
function pointAt(angleDeg: number, radius: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CENTER + radius * Math.sin(rad), y: CENTER - radius * Math.cos(rad) };
}

export function UserLocationMarker({ position, heading }: Props) {
  if (!position) return null;

  const halfAngle = VIEW_CONE_ANGLE_DEG / 2;
  const left = pointAt(-halfAngle, VIEW_CONE_RADIUS_PX);
  const right = pointAt(halfAngle, VIEW_CONE_RADIUS_PX);
  const conePath = `M ${CENTER} ${CENTER} L ${left.x} ${left.y} A ${VIEW_CONE_RADIUS_PX} ${VIEW_CONE_RADIUS_PX} 0 0 1 ${right.x} ${right.y} Z`;

  return (
    <Marker longitude={position.lng} latitude={position.lat} anchor="center">
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label="Your location"
        style={{ pointerEvents: 'none' }}
      >
        {heading != null && (
          <g transform={`rotate(${heading} ${CENTER} ${CENTER})`}>
            <path
              d={conePath}
              fill={LOCATION_MARKER_COLOR}
              fillOpacity={VIEW_CONE_FILL_OPACITY}
              stroke={LOCATION_MARKER_COLOR}
              strokeOpacity={VIEW_CONE_STROKE_OPACITY}
              strokeWidth={1.5}
            />
          </g>
        )}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={DOT_RADIUS}
          fill={LOCATION_MARKER_COLOR}
          stroke="#fff"
          strokeWidth={2}
        />
      </svg>
    </Marker>
  );
}
