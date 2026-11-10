import type { ReviewComparison } from '../../../shared/rules/review-comparison';

export function reviewComparison(
  kind?: string,
  base?: string,
): ReviewComparison {
  return kind === 'branch'
    ? { kind: 'branch', ...(base ? { base } : {}) }
    : { kind: 'worktree' };
}

export function reviewFileDocumentKey(
  path: string,
  comparison: ReviewComparison,
) {
  return JSON.stringify([
    'review-file',
    comparison.kind === 'worktree'
      ? ['worktree']
      : ['branch', comparison.base ?? null],
    path,
  ]);
}

export function reviewParams(key: string, comparison: ReviewComparison) {
  return {
    workspace: key,
    comparison: comparison.kind,
    ...(comparison.kind === 'branch' && comparison.base
      ? { base: comparison.base }
      : {}),
  };
}

export function reviewFileReadingKey(
  path: string,
  comparison: ReviewComparison,
  scope?: string,
) {
  return JSON.stringify([reviewFileDocumentKey(path, comparison), scope]);
}
