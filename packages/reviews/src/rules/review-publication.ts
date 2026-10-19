import type { ChangeComparison } from '@porcelain/kernel/models';
import type { ReviewVerdict } from '../models/review.ts';

function githubRepository(origin: string | undefined): string | undefined {
  if (origin === undefined) return undefined;
  const scp =
    /^(?:[^@]+@)?github\.com:([^/]+\/[^/]+?)(?:\.git)?\/?$/i.exec(
      origin.trim(),
    ) ?? undefined;
  if (scp !== undefined) return scp[1]?.toLowerCase();
  try {
    const url = URL.parse(origin) ?? undefined;
    if (url === undefined) return undefined;
    return url.hostname.toLowerCase() === 'github.com'
      ? url.pathname
          .replace(/^\//, '')
          .replace(/\/$/, '')
          .replace(/\.git$/, '')
          .toLowerCase()
      : undefined;
  } catch {
    return undefined;
  }
}

export function reviewPublicationProblem(input: {
  dirtyPaths: readonly string[];
  proofPaths: readonly string[];
  deletedPaths: readonly string[];
  verdict: ReviewVerdict;
  origin: string | undefined;
  pullRequest: string | undefined;
}): string | undefined {
  const excluded = new Set(input.proofPaths);
  const dirty = [...new Set(input.dirtyPaths)].filter(
    (path) => !excluded.has(path),
  );
  if (dirty.length > 0)
    return `Commit first: ${dirty.length} files differ from HEAD (${dirty.join(', ')})`;
  const explained = new Set(
    input.verdict.removed.flatMap((entry) => entry.paths),
  );
  const deleted = input.deletedPaths.find((path) => !explained.has(path));
  if (deleted !== undefined)
    return `Explain every removal: ${deleted} is deleted but no verdict.removed entry names it.`;
  if (input.pullRequest !== undefined) {
    const repository = URL.parse(input.pullRequest)
      ?.pathname.split('/')
      .slice(1, 3)
      .join('/')
      .toLowerCase();
    if (repository !== githubRepository(input.origin))
      return `The pullRequest repository differs from origin. Use a PR from ${input.origin ?? 'this repository (configure origin first)'}, or omit pullRequest.`;
  }
  return undefined;
}

export function normalizedReviewPullRequest(
  value: string | undefined,
): string | undefined {
  if (value === undefined) return undefined;
  const url = URL.parse(value) ?? undefined;
  if (url === undefined) return undefined;
  const [owner = '', repository = '', , number = ''] = url.pathname
    .split('/')
    .slice(1);
  return `https://github.com/${owner.toLowerCase()}/${repository.toLowerCase()}/pull/${number}`;
}

export function reviewDirtyPaths(
  comparisons: readonly ChangeComparison[],
): string[] {
  return [
    ...new Set(
      comparisons.flatMap((comparison) =>
        'path' in comparison
          ? [comparison.path]
          : [comparison.oldPath, comparison.newPath].filter(
              (path) => path !== undefined,
            ),
      ),
    ),
  ];
}

export function reviewPullRequestNumber(
  value: string | undefined,
): number | undefined {
  return value === undefined
    ? undefined
    : Number(URL.parse(value)?.pathname.split('/')[4]);
}
