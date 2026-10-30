import { expect, it } from 'vitest';
import { reviewFixture } from '../../spec/fixtures/review.ts';
import {
  normalizedReviewPullRequest,
  reviewDirtyPaths,
  reviewPublicationProblem,
  reviewPullRequestNumber,
  reviewPullRequestsMatch,
} from './review-publication.ts';
const clean = {
  dirtyPaths: [],
  proofPaths: [],
  deletedPaths: [],
  verdict: reviewFixture().verdict,
  origin: 'git@github.com:FabioFiorita/porcelain.git',
  pullRequest: undefined,
};
it('refuses dirty paths once, excluding only the exact proof asset paths', () => {
  expect(
    reviewPublicationProblem({
      ...clean,
      dirtyPaths: ['src/a.ts', 'shot.png', 'src/a.ts', 'src/b.ts'],
      proofPaths: ['shot.png'],
    }),
  ).toBe('Commit first: 2 files differ from HEAD (src/a.ts, src/b.ts)');
  expect(
    reviewPublicationProblem({
      ...clean,
      dirtyPaths: ['shot.png'],
      proofPaths: ['shot.png'],
    }),
  ).toBeUndefined();
});
it('requires every deleted path to be named by a removal', () => {
  expect(
    reviewPublicationProblem({ ...clean, deletedPaths: ['gone.ts'] }),
  ).toBe(
    'Explain every removal: gone.ts is deleted but no verdict.removed entry names it.',
  );
  expect(
    reviewPublicationProblem({
      ...clean,
      deletedPaths: ['gone.ts'],
      verdict: {
        ...clean.verdict,
        removed: [
          { behavior: 'Old owner', why: 'Replaced', paths: ['gone.ts'] },
        ],
      },
    }),
  ).toBeUndefined();
});
it.each([
  'git@github.com:FabioFiorita/porcelain.git',
  'https://github.com/FabioFiorita/porcelain.git',
  'ssh://git@github.com/FabioFiorita/porcelain.git',
])('accepts a PR from origin %s', (origin) => {
  expect(
    reviewPublicationProblem({
      ...clean,
      origin,
      pullRequest: 'https://github.com/FabioFiorita/porcelain/pull/42',
    }),
  ).toBeUndefined();
});
it('rejects a foreign PR or unconfigured origin with an actionable message', () => {
  expect(
    reviewPublicationProblem({
      ...clean,
      pullRequest: 'https://github.com/other/repo/pull/42',
    }),
  ).toBe(
    'The pullRequest repository differs from origin. Use a PR from git@github.com:FabioFiorita/porcelain.git, or omit pullRequest.',
  );
  expect(
    reviewPublicationProblem({
      ...clean,
      origin: undefined,
      pullRequest: 'https://github.com/other/repo/pull/42',
    }),
  ).toBe(
    'The pullRequest repository differs from origin. Use a PR from this repository (configure origin first), or omit pullRequest.',
  );
});
it('canonicalizes the PR URL without losing display case and identifies its number', () => {
  expect(
    normalizedReviewPullRequest('https://github.com/Owner/Repo/pull/42/'),
  ).toBe('https://github.com/Owner/Repo/pull/42');
  expect(normalizedReviewPullRequest(undefined)).toBeUndefined();
  expect(reviewPullRequestNumber('https://github.com/Owner/Repo/pull/42')).toBe(
    42,
  );
  expect(reviewPullRequestNumber(undefined)).toBeUndefined();
});
it('includes both paths of a rename in the dirty path set', () => {
  expect(
    reviewDirtyPaths([
      {
        scope: 'unstaged',
        kind: 'renamed',
        oldPath: 'old',
        newPath: 'new',
        oldMode: '100644',
        newMode: '100644',
        oldOid: undefined,
        newOid: undefined,
        supported: true,
      },
    ]),
  ).toEqual(['old', 'new']);
});

it('matches differently cased PR links without confusing numbers or repositories', () => {
  expect(
    reviewPullRequestsMatch(
      'https://github.com/Owner/Repo/pull/42/',
      'https://github.com/owner/repo/pull/42',
    ),
  ).toBe(true);
  expect(
    reviewPullRequestsMatch(
      'https://github.com/Owner/Repo/pull/42',
      'https://github.com/owner/repo/pull/43',
    ),
  ).toBe(false);
  expect(
    reviewPullRequestsMatch(
      'https://github.com/Owner/Repo/pull/42',
      'https://github.com/other/repo/pull/42',
    ),
  ).toBe(false);
  expect(
    reviewPullRequestsMatch(undefined, 'https://github.com/owner/repo/pull/42'),
  ).toBe(false);
});
