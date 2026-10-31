import { expect, it } from 'vitest';
import { quickOpenMatches, quickOpenPath } from './quick-open.ts';

it('ranks exact basenames before prefixes, contained names and directory matches', () => {
  expect(
    quickOpenMatches(
      ['app/x.ts', 'xapp.ts', 'apps.ts', 'deep/App', 'app', 'no-match.ts'],
      ' APP ',
    ),
  ).toEqual(['app', 'deep/App', 'apps.ts', 'xapp.ts', 'app/x.ts']);
});

it('breaks equal ranks by shorter paths then deterministic path order', () => {
  expect(
    quickOpenMatches(
      ['z/foo.ts', 'a/foo.ts', 'foo.ts', 'long/foo.ts'],
      'foo.ts',
    ),
  ).toEqual(['foo.ts', 'a/foo.ts', 'z/foo.ts', 'long/foo.ts']);
});

it('ranks the entire candidate set before limiting it to 50 files', () => {
  const paths = Array.from({ length: 60 }, (_, index) => `target/f${index}.ts`);
  const matches = quickOpenMatches(
    [...paths, 'deep/target', 'target.ts'],
    'target',
  );
  expect(matches).toHaveLength(50);
  expect(matches.slice(0, 4)).toEqual([
    'deep/target',
    'target.ts',
    'target/f0.ts',
    'target/f1.ts',
  ]);
  expect(matches).not.toContain('target/f59.ts');
});

it.each(['folder/.env', ' .env ', 'src/Index.ts'])(
  'accepts the explicit relative path %s',
  (query) => {
    expect(quickOpenPath(query)).toBe(query.trim());
  },
);

it.each([
  '',
  'readme',
  '../.env',
  '/etc/passwd',
  'folder//file',
  'folder/../file',
  '.git/config',
  'C:/file',
  'folder\\file',
])('rejects the non-explicit or invalid path %s', (query) => {
  expect(quickOpenPath(query)).toBeNull();
});
