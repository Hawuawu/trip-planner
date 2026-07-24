import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hasKanji } from '../utils/kanjiReading';

describe('hasKanji', () => {
  it('returns true for kanji-containing strings', () => {
    expect(hasKanji('成田空港')).toBe(true);
    expect(hasKanji('Tokyo 東京')).toBe(true);
  });

  it('returns false for pure hiragana', () => {
    expect(hasKanji('なりたくうこう')).toBe(false);
  });

  it('returns false for pure katakana', () => {
    expect(hasKanji('トウキョウ')).toBe(false);
  });

  it('returns false for romaji', () => {
    expect(hasKanji('Narita Airport')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(hasKanji('')).toBe(false);
  });
});

const { convertMock } = vi.hoisted(() => ({ convertMock: vi.fn() }));

vi.mock('@sglkc/kuroshiro', () => ({
  default: vi.fn().mockImplementation(function KuroshiroMock() {
    return {
      init: vi.fn().mockResolvedValue(undefined),
      convert: convertMock,
    };
  }),
}));

vi.mock('@sglkc/kuroshiro-analyzer-kuromoji', () => ({
  default: vi.fn().mockImplementation(function KuromojiAnalyzerMock() {
    return {};
  }),
}));

describe('convertToTitleCaseRomaji', () => {
  beforeEach(() => {
    convertMock.mockReset();
    vi.resetModules();
  });

  it('title-cases each spaced romaji token and joins them with hyphens', async () => {
    convertMock.mockResolvedValueOnce('suisan nakaoroshi tō');
    const { convertToTitleCaseRomaji } = await import('../utils/kanjiReading');
    const result = await convertToTitleCaseRomaji('水産仲卸棟');
    expect(result).toBe('Suisan-Nakaoroshi-Tō');
  });

  it('collapses repeated spaces without producing empty segments', async () => {
    convertMock.mockResolvedValueOnce('gin  no  suzu');
    const { convertToTitleCaseRomaji } = await import('../utils/kanjiReading');
    const result = await convertToTitleCaseRomaji('銀の鈴');
    expect(result).toBe('Gin-No-Suzu');
  });
});
