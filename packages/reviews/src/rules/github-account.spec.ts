import { expect, it } from 'vitest';
import {
  githubAccountCandidates,
  githubRepository,
  pickGitHubAccount,
} from './github-account.ts';
it.each([
  [
    [
      { account: 'personal', canRead: true },
      { account: 'work', canRead: false },
    ],
    undefined,
    { account: 'personal', source: 'detected' },
  ],
  [
    [
      { account: 'personal', canRead: true },
      { account: 'work', canRead: true },
    ],
    undefined,
    { account: 'personal', source: 'detected' },
  ],
  [
    [
      { account: 'personal', canRead: false },
      { account: 'work', canRead: false },
    ],
    undefined,
    undefined,
  ],
  [
    [
      { account: 'personal', canRead: true },
      { account: 'work', canRead: true },
    ],
    'work',
    { account: 'work', source: 'overridden' },
  ],
  [
    [
      { account: 'personal', canRead: true },
      { account: 'work', canRead: false },
    ],
    'work',
    undefined,
  ],
] as const)(
  'selects only an accessible account and never silently replaces an override',
  (candidates, override, expected) => {
    expect(pickGitHubAccount(candidates, override)).toEqual(expected);
  },
);
it('prefers the remembered choice only for the same origin and keeps overrides explicit', () => {
  expect(
    githubAccountCandidates(
      ['work', 'personal'],
      { repository: 'a/b', detected: 'work', override: undefined },
      'a/b',
    ),
  ).toEqual(['work', 'personal']);
  expect(
    githubAccountCandidates(
      ['work', 'personal'],
      { repository: 'old/repo', detected: 'work', override: undefined },
      'a/b',
    ),
  ).toEqual(['personal', 'work']);
  expect(
    githubAccountCandidates(
      ['personal'],
      { repository: 'a/b', detected: 'personal', override: 'work' },
      'a/b',
    ),
  ).toEqual([]);
});
it.each([
  'git@github.com:FabioFiorita/porcelain.git',
  'https://github.com/FabioFiorita/porcelain.git',
  'ssh://git@github.com/FabioFiorita/porcelain.git',
])('recognizes GitHub origins', (origin) => {
  expect(githubRepository(origin)).toEqual({
    owner: 'FabioFiorita',
    repo: 'porcelain',
  });
});
it.each([
  undefined,
  'git@gitlab.com:a/b.git',
  'https://github.com/a/b/extra',
  'https://evil.test/a/b',
  'file:///a/b',
])('rejects non-GitHub origins', (origin) => {
  expect(githubRepository(origin)).toBeUndefined();
});
