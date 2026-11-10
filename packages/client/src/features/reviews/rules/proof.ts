import type { ReviewResponse } from './review.ts';

export type ReviewProof = ReviewResponse['proof'];
export type ProofCheck = ReviewProof['checks'][number];

type ProofStatus = {
  failing: number;
  passing: number;
  current: boolean;
};

const RESULT_ORDER: readonly ProofCheck['result'][] = ['fail', 'pass'];

export function proofStatus(proof: ReviewProof | undefined): ProofStatus {
  const checks = proof?.checks ?? [];
  const count = (result: ProofCheck['result']) =>
    checks.filter((check) => check.result === result).length;
  return {
    failing: count('fail'),
    passing: count('pass'),
    current: proof?.current ?? true,
  };
}

export function orderedChecks(checks: readonly ProofCheck[]): ProofCheck[] {
  return [...checks].sort(
    (left, right) =>
      RESULT_ORDER.indexOf(left.result) - RESULT_ORDER.indexOf(right.result),
  );
}

export function publishedLabel(publishedAt: string): string {
  return new Date(publishedAt).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
