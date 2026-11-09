import { readdirSync } from 'node:fs';
import { expect, it } from 'vitest';
import { browserShardFiles } from './browser-shards.ts';
import timings from './browser-shards.json' with { type: 'json' };

const weights = {
  fileOverheadMs: 2,
  durationsMs: { heavy: 90, medium: 70, small: 20, tiny: 10 },
};

it('keeps expensive files apart and fills the lighter shard first', () => {
  expect(
    browserShardFiles(['heavy', 'medium', 'small', 'tiny'], 2, weights),
  ).toEqual([
    ['heavy', 'tiny'],
    ['medium', 'small'],
  ]);
});

it('assigns new and renamed files a median cost without dropping them', () => {
  const files = ['heavy', 'new', 'renamed'];
  expect(browserShardFiles(files, 2, weights)).toEqual([
    ['heavy'],
    ['new', 'renamed'],
  ]);
  expect(browserShardFiles([...files].reverse(), 2, weights)).toEqual(
    browserShardFiles(files, 2, weights),
  );
});

it('partitions only the filtered files when there are more shards than files', () => {
  expect(browserShardFiles(['tiny', 'medium'], 4, weights)).toEqual([
    ['medium'],
    ['tiny'],
    [],
    [],
  ]);
});

it.each([1, 2, 4, 8])(
  'runs every actual browser file exactly once across %i shards',
  (count) => {
    const files = readdirSync(new URL('../integration', import.meta.url))
      .filter((file) => file.endsWith('.test.tsx'))
      .map((file) => `spec/integration/${file}`);
    const shards = browserShardFiles(files, count, timings);
    expect(shards.flat().sort()).toEqual([...files].sort());
    expect(new Set(shards.flat()).size).toBe(files.length);
    expect(browserShardFiles([...files].reverse(), count, timings)).toEqual(
      shards,
    );
  },
);
