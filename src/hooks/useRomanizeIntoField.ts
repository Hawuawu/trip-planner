import { useCallback, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { convertToTitleCaseRomaji } from '../utils/kanjiReading';

export type RomanizeStatus = 'idle' | 'loading' | 'done' | 'error' | 'unavailable-offline';

export function romanizeStatusMessage(status: RomanizeStatus): string | undefined {
  if (status === 'loading') return 'Loading reading…';
  if (status === 'error') return 'Translation unavailable';
  if (status === 'unavailable-offline') return 'Translation unavailable offline';
  return undefined;
}

// Converts the current field value to title-cased, hyphenated romaji and
// appends it in parentheses directly onto the field, e.g. "水産仲卸棟" ->
// "水産仲卸棟 (Suisan-Nakaoroshi-Tō)" — a one-shot insert, not a togglable
// preview. Never throws; failures surface via `status` instead.
export function useRomanizeIntoField(setValue: Dispatch<SetStateAction<string>>) {
  const [status, setStatus] = useState<RomanizeStatus>('idle');

  const romanize = useCallback(
    (currentValue: string) => {
      setStatus('loading');
      convertToTitleCaseRomaji(currentValue)
        .then((reading) => {
          setValue((prev) => `${prev} (${reading})`);
          setStatus('done');
        })
        .catch(() => {
          setStatus(navigator.onLine ? 'error' : 'unavailable-offline');
        });
    },
    [setValue]
  );

  const resetStatus = useCallback(() => setStatus('idle'), []);

  return { status, romanize, resetStatus };
}
