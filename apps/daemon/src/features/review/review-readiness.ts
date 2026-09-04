import type { ReviewReadinessInput, ReviewReadinessOutput } from '@porcelain/contracts/review'
import { gitCommitFiles, gitLog, gitStatus } from '../../git/git-log'
import { runGit } from '../../git/git-exec'
import { gitRangeChangedFiles } from '../../git/git-ranges'
import { workingTreeFingerprint } from '../../git/git-fingerprints'
import { gitResolveCompareBase } from '../../git/git-refs'
import { readStoredReviewCanvasForReadiness } from '../../stores/review-store'

async function resolvedCommitHash(repoPath: string, hash: string): Promise<string> {
  return (await runGit(repoPath, ['rev-parse', '--verify', `${hash}^{commit}`])).trim()
}

/** Daemon-derived Review readiness; no client cache or score participates. */
export async function readReviewReadiness(
  input: ReviewReadinessInput,
): Promise<ReviewReadinessOutput> {
  // Start with the Review selected for this Worktree. A missing binding is materially
  // different from a missing Canvas: range/commit callers need to see it as stale rather
  // than receive a fabricated absence.
  const selected = await readStoredReviewCanvasForReadiness(input.repoPath)
  const rangeBase =
    input.scope.type === 'range'
      ? await gitResolveCompareBase(input.repoPath, input.scope.base)
      : undefined
  const changed =
    input.scope.type === 'working'
      ? await gitStatus(input.repoPath)
      : input.scope.type === 'range'
        ? await gitRangeChangedFiles(input.repoPath, rangeBase ?? '')
        : await gitCommitFiles(input.repoPath, input.scope.hash)
  if (selected.state !== 'available') {
    const missingPaths = changed.map((file) => file.path)
    return {
      evidence: { checks: 0, passed: 0, failed: 0, skipped: 0, assets: 0 },
      freshness: selected.state === 'unavailable' ? 'unavailable' : 'absent',
      binding: 'none',
      canvas: selected.state === 'unavailable' ? { id: selected.id } : null,
      coverage: {
        changedFileCount: changed.length,
        orderedFileCount: 0,
        missingPaths,
        missingCount: missingPaths.length,
      },
      ...(selected.state === 'unavailable' ? { issue: 'unavailable' as const } : {}),
    }
  }
  const canvas = selected.canvas
  const review = canvas.review
  const ordered = new Set(review.files.map((file) => file.path))
  const missingPaths = changed.map((file) => file.path).filter((path) => !ordered.has(path))
  const expected =
    input.scope.type === 'commit'
      ? await resolvedCommitHash(input.repoPath, input.scope.hash)
      : input.scope.type === 'range'
        ? (await gitLog(input.repoPath, 1))[0]?.hash
        : undefined
  const currentWorkingFingerprint =
    input.scope.type === 'working' ? await workingTreeFingerprint(input.repoPath) : undefined
  const currentHead =
    input.scope.type === 'working' && review.commitHash !== undefined
      ? (await gitLog(input.repoPath, 1))[0]?.hash
      : undefined
  const matches =
    (input.scope.type === 'working' &&
      review.workingFingerprint !== undefined &&
      review.workingFingerprint === currentWorkingFingerprint &&
      (review.commitHash === undefined || review.commitHash === currentHead)) ||
    (expected !== undefined && review.commitHash !== undefined && review.commitHash === expected)
  return {
    // A range always represents an immutable tip, so an unbound live Canvas cannot
    // truthfully be fresh for it. Working Reviews may remain current while uncommitted.
    freshness: matches ? 'current' : 'stale',
    binding:
      review.commitHash === undefined
        ? input.scope.type === 'working'
          ? 'live'
          : 'unbound'
        : 'commit',
    canvas: {
      id: canvas.id,
      ...(review.commitHash === undefined ? {} : { commitHash: review.commitHash }),
    },
    coverage: {
      changedFileCount: changed.length,
      orderedFileCount: new Set(
        review.files
          .map((file) => file.path)
          .filter((path) => changed.some((file) => file.path === path)),
      ).size,
      missingPaths,
      missingCount: missingPaths.length,
    },
    evidence: {
      checks: canvas.evidence.checks.length,
      passed: canvas.evidence.checks.filter((check) => check.status === 'pass').length,
      failed: canvas.evidence.checks.filter((check) => check.status === 'fail').length,
      skipped: canvas.evidence.checks.filter((check) => check.status === 'skip').length,
      assets: canvas.evidence.assets,
    },
  }
}
