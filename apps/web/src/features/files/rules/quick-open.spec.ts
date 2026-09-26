import { expect, it } from 'vitest';
import { quickOpenMatches } from './quick-open.ts';

it('matches trimmed text without case sensitivity and preserves path order', () => {
  expect(
    quickOpenMatches(['src/App.tsx', 'README.md', 'src/app.test.tsx'], ' APP '),
  ).toEqual(['src/App.tsx', 'src/app.test.tsx']);
});

it('limits the empty search to the first fifty paths', () => {
  const paths = Array.from({ length: 53 }, (_, index) => `file-${index}`);
  expect(quickOpenMatches(paths, '')).toEqual(paths.slice(0, 50));
});
