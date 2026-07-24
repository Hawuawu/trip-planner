import { Box } from '@mui/material';
import type { ReadingState } from '../hooks/useKanjiReading';

interface Props {
  state: ReadingState;
}

// Renders the revealed romaji reading as an italic, secondary-color suffix —
// e.g. "(Narita Kūkō)" — so it reads as a quiet annotation on the original
// kanji text rather than competing with it.
export function InlineReading({ state }: Props) {
  if (state.status === 'idle') return null;

  const text =
    state.status === 'loading'
      ? 'Loading reading…'
      : state.status === 'ready'
        ? `(${state.reading})`
        : state.status === 'unavailable-offline'
          ? 'Translation unavailable offline'
          : 'Translation unavailable';

  return (
    <Box component="span" sx={{ color: 'text.secondary', fontStyle: 'italic', ml: 0.5 }}>
      {text}
    </Box>
  );
}
