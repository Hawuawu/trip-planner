import { useCallback, useEffect, useState } from 'react';

export type DeviceOrientationPermissionState = 'unsupported' | 'prompt' | 'granted' | 'denied';

// iOS Safari gates deviceorientation behind a static requestPermission() on
// the DeviceOrientationEvent constructor — not part of the standard DOM
// types, so this narrows the global to only what we need from it.
interface RequestableDeviceOrientationEvent {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

// iOS Safari exposes compass heading via this non-standard field instead of
// computing it from `alpha` like every other browser.
interface CompassOrientationEvent extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
}

function isRequestable(
  ctor: unknown
): ctor is RequestableDeviceOrientationEvent & {
  requestPermission: () => Promise<'granted' | 'denied'>;
} {
  return (
    typeof ctor === 'object' &&
    ctor !== null &&
    typeof (ctor as RequestableDeviceOrientationEvent).requestPermission === 'function'
  );
}

function headingFromEvent(event: CompassOrientationEvent): number | null {
  if (typeof event.webkitCompassHeading === 'number') return event.webkitCompassHeading;
  if (event.alpha == null) return null;
  return 360 - event.alpha;
}

export function useDeviceOrientation(enabled: boolean) {
  const [heading, setHeading] = useState<number | null>(null);
  const [permissionState, setPermissionState] = useState<DeviceOrientationPermissionState>(() =>
    typeof DeviceOrientationEvent === 'undefined' ? 'unsupported' : 'prompt'
  );

  const requestPermission = useCallback(async () => {
    if (typeof DeviceOrientationEvent === 'undefined') {
      setPermissionState('unsupported');
      return;
    }
    if (!isRequestable(DeviceOrientationEvent)) {
      setPermissionState('granted');
      return;
    }
    const result = await DeviceOrientationEvent.requestPermission();
    setPermissionState(result);
  }, []);

  useEffect(() => {
    if (!enabled || permissionState !== 'granted') {
      setHeading(null);
      return;
    }

    const handleOrientation = (event: Event) =>
      setHeading(headingFromEvent(event as CompassOrientationEvent));

    const eventName =
      'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
    window.addEventListener(eventName, handleOrientation);
    return () => window.removeEventListener(eventName, handleOrientation);
  }, [enabled, permissionState]);

  return { heading, permissionState, requestPermission };
}
