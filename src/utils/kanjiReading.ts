// Lazily loads kuroshiro + its kuromoji dictionary only when a reading is
// actually requested, so users who never use "show reading" pay no bundle
// or boot cost for it.

import type Kuroshiro from '@sglkc/kuroshiro';

export function hasKanji(text: string): boolean {
  return /[一-龯]/.test(text);
}

let instancePromise: Promise<Kuroshiro> | null = null;

async function getKuroshiro(): Promise<Kuroshiro> {
  if (!instancePromise) {
    instancePromise = (async () => {
      const [{ default: KuroshiroClass }, { default: KuromojiAnalyzer }] = await Promise.all([
        import('@sglkc/kuroshiro'),
        import('@sglkc/kuroshiro-analyzer-kuromoji'),
      ]);
      const kuroshiro = new KuroshiroClass();
      await kuroshiro.init(new KuromojiAnalyzer({ dictPath: '/dict/' }));
      return kuroshiro;
    })().catch((err: unknown) => {
      instancePromise = null;
      throw err;
    });
  }
  return instancePromise;
}

export async function convertToRomaji(text: string): Promise<string> {
  const kuroshiro = await getKuroshiro();
  return kuroshiro.convert(text, { to: 'romaji', mode: 'normal' });
}

function capitalize(word: string): string {
  return word.length === 0 ? word : word[0].toUpperCase() + word.slice(1);
}

// Proper-noun style for names, e.g. "水産仲卸棟" -> "Suisan-Nakaoroshi-Tō".
// Kuroshiro's `mode: 'spaced'` returns one lowercase romaji token per
// kuromoji morpheme (space-separated); title-casing each and hyphenating
// mirrors how compound Japanese place/building names are conventionally
// romanized. Only used for the Name-field insert — full-sentence text
// (e.g. Notes) would have grammatical particles capitalized too, which
// reads oddly, so that path stays on `convertToRomaji` above.
export async function convertToTitleCaseRomaji(text: string): Promise<string> {
  const kuroshiro = await getKuroshiro();
  const spaced: string = await kuroshiro.convert(text, { to: 'romaji', mode: 'spaced' });
  return spaced.split(' ').filter(Boolean).map(capitalize).join('-');
}
