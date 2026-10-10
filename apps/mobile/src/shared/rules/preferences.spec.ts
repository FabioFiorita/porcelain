import { describe, expect, it } from 'vitest';
import { readPreferences } from './preferences';

describe('saved mobile preferences', () => {
  it('keeps the existing mobile defaults on first launch', () => {
    expect(readPreferences(null)).toEqual({
      theme: 'system',
      wrapLongLines: true,
      markdownDefault: 'reader',
      htmlDefault: 'preview',
    });
  });

  it('restores each explicit setting after a cold launch', () => {
    expect(
      readPreferences(
        '{"theme":"dark","wrapLongLines":false,"markdownDefault":"source","htmlDefault":"source"}',
      ),
    ).toEqual({
      theme: 'dark',
      wrapLongLines: false,
      markdownDefault: 'source',
      htmlDefault: 'source',
    });
  });

  it.each([
    { theme: 'automatic' },
    { wrapLongLines: 'false' },
    { markdownDefault: 'preview' },
    { htmlDefault: 'reader' },
  ])('refuses unsupported persisted values: %j', (invalid) => {
    expect(() =>
      readPreferences(
        JSON.stringify({
          theme: 'system',
          wrapLongLines: true,
          markdownDefault: 'reader',
          htmlDefault: 'preview',
          ...invalid,
        }),
      ),
    ).toThrow();
  });

  it.each(['not-json', '{}', 'null', '[]'])(
    'refuses unreadable saved data instead of overwriting it with defaults: %s',
    (saved) => {
      expect(() => readPreferences(saved)).toThrow();
    },
  );
});
