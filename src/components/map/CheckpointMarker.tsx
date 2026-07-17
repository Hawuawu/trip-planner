import { Marker, Popup } from 'react-leaflet';
import { divIcon } from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import { CheckpointIcon } from '../timeline/CheckpointIcon';
import type { Checkpoint } from '../../types';

interface Props {
  checkpoint: Checkpoint;
  isSelected: boolean;
  onSelect(): void;
}

function makeIcon(checkpoint: Checkpoint, isSelected: boolean) {
  const color = isSelected ? '#e94560' : '#1a1a2e';
  const svg = renderToStaticMarkup(
    <CheckpointIcon type={checkpoint.type} style={{ color, width: 20, height: 20 }} />
  );
  return divIcon({
    html: `<div style="background:${isSelected ? '#e94560' : '#fff'};border:2px solid ${color};border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;color:${isSelected ? '#fff' : color}">${svg}</div>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export function CheckpointMarker({ checkpoint, isSelected, onSelect }: Props) {
  if (!checkpoint.location) return null;

  return (
    <Marker
      position={[checkpoint.location.lat, checkpoint.location.lng]}
      icon={makeIcon(checkpoint, isSelected)}
      eventHandlers={{ click: onSelect }}
    >
      <Popup>
        <strong>{checkpoint.name}</strong>
        {checkpoint.location.label && <><br />{checkpoint.location.label}</>}
      </Popup>
    </Marker>
  );
}
