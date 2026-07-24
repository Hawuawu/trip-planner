import { useCallback, useState } from 'react';
import { convertToRomaji } from '../utils/kanjiReading';

export type ReadingState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; reading: string }
  | { status: 'unavailable-offline' }
  | { status: 'error' };

export function useKanjiReading() {
  const [state, setState] = useState<ReadingState>({ status: 'idle' });

  const reveal = useCallback((text: string) => {
    setState({ status: 'loading' });
    convertToRomaji(text)
      .then((reading) => setState({ status: 'ready', reading }))
      .catch(() => {
        setState({ status: navigator.onLine ? 'error' : 'unavailable-offline' });
      });
  }, []);

  return { state, reveal };
}
