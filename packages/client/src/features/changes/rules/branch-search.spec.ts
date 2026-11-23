import { expect, it } from 'vite-plus/test';
import { branchSearchGroups, branchSearchMatches } from './branch-search.ts';

const branches = [
  'chore/merge-main',
  'docs/readme-main',
  'feat/search-ranking',
  'feature/note-search',
  'feature/notes-archive',
  'fix/search-empty',
  'main',
  'mainline-sync',
  'release/main-2026',
  'spike/menu-a11y',
];

it.each([
  [
    'ma',
    [
      'main',
      'mainline-sync',
      'chore/merge-main',
      'docs/readme-main',
      'release/main-2026',
      'spike/menu-a11y',
    ],
  ],
  [
    'sea',
    [
      'feature/note-search',
      'feat/search-ranking',
      'fix/search-empty',
      'spike/menu-a11y',
      'feature/notes-archive',
      'docs/readme-main',
      'release/main-2026',
    ],
  ],
  [
    'fsr',
    [
      'feat/search-ranking',
      'feature/note-search',
      'fix/search-empty',
      'feature/notes-archive',
    ],
  ],
  ['note', ['feature/note-search', 'feature/notes-archive']],
  [
    'mn',
    [
      'main',
      'mainline-sync',
      'chore/merge-main',
      'docs/readme-main',
      'spike/menu-a11y',
      'release/main-2026',
    ],
  ],
])('ranks branches for “%s” best first', (query, ranked) => {
  expect(branchSearchMatches(branches, query, (name) => name)).toEqual(ranked);
});

it('keeps every branch in order while the search is empty', () => {
  expect(branchSearchMatches(branches, '', (name) => name)).toEqual(branches);
});

it('hides a branch whose name lacks the letters in order', () => {
  expect(
    branchSearchMatches(['main', 'release'], 'zz', (name) => name),
  ).toEqual([]);
});

it('puts the group holding the best match first', () => {
  expect(
    branchSearchGroups(
      [
        { heading: 'Local', entries: [{ name: 'release/main-2026' }] },
        {
          heading: 'Remote',
          entries: [{ name: 'origin/main' }, { name: 'x' }],
        },
      ],
      'origin',
    ),
  ).toEqual([{ heading: 'Remote', entries: [{ name: 'origin/main' }] }]);
  expect(
    branchSearchGroups(
      [
        { heading: 'Local', entries: [{ name: 'release/main-2026' }] },
        { heading: 'Remote', entries: [{ name: 'origin/main' }] },
      ],
      'main',
    ).map((group) => group.heading),
  ).toEqual(['Remote', 'Local']);
});
