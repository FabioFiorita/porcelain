import { expect, it } from 'vite-plus/test';
import { firstListedEntries } from './first-listed-entries.ts';

it('keeps folders first, then names in code unit order, up to the limit', () => {
  expect(
    firstListedEntries(
      [
        { name: 'b.md', kind: 'file' },
        { name: 'z', kind: 'directory' },
        { name: 'B.md', kind: 'file' },
        { name: 'a', kind: 'directory' },
        { name: 'c.md', kind: 'file' },
      ],
      3,
    ),
  ).toEqual({
    entries: [
      { name: 'a', kind: 'directory' },
      { name: 'z', kind: 'directory' },
      { name: 'B.md', kind: 'file' },
    ],
    omitted: 2,
  });
});

it('leaves the Git folder out of both the listing and the count', () => {
  expect(
    firstListedEntries(
      [
        { name: '.git', kind: 'directory' },
        { name: 'a.md', kind: 'file' },
        { name: 'b.md', kind: 'file' },
      ],
      1,
    ),
  ).toEqual({ entries: [{ name: 'a.md', kind: 'file' }], omitted: 1 });
});
