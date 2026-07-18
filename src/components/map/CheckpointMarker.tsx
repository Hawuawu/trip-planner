import { useState } from 'react';
import { Marker, Popup } from 'react-map-gl/maplibre';
import { CheckpointIcon } from '../timeline/CheckpointIcon';
import type { Checkpoint } from '../../types';

interface Props {
  checkpoint: Checkpoint;
  isSelected: boolean;
  onSelect(): void;
}

export function CheckpointMarker({ checkpoint, isSelected, onSelect }: Props) {
  const [showPopup, setShowPopup] = useState(false);
  if (!checkpoint.location) return null;

  const color = isSelected ? '#e94560' : '#1a1a2e';

  return (
    <>
      <Marker
        longitude={checkpoint.location.lng}
        latitude={checkpoint.location.lat}
        anchor="center"
        onClick={(e) => {
          e.originalEvent.stopPropagation();
          onSelect();
          setShowPopup(true);
        }}
      >
        <div
          style={{
            background: isSelected ? '#e94560' : '#fff',
            border: `2px solid ${color}`,
            borderRadius: '50%',
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isSelected ? '#fff' : color,
            cursor: 'pointer',
          }}
        >
          <CheckpointIcon type={checkpoint.type} style={{ width: 20, height: 20 }} />
        </div>
      </Marker>

      {showPopup && (
        <Popup
          longitude={checkpoint.location.lng}
          latitude={checkpoint.location.lat}
          anchor="bottom"
          onClose={() => setShowPopup(false)}
          closeOnClick={false}
        >
          <strong>{checkpoint.name}</strong>
          {checkpoint.location.label && (
            <>
              <br />
              {checkpoint.location.label}
            </>
          )}
        </Popup>
      )}
    </>
  );
}
