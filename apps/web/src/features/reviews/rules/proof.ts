import type { ReadProofFileResponse } from '@porcelain/contracts/reviews';
import type { ReviewResponse } from './review';

export type ReviewProof = ReviewResponse['proof'];
export type ProofCheck = ReviewProof['checks'][number];
export type ProofAsset = ReviewProof['assets'][number];
export type ProofFile = ReadProofFileResponse;

type ProofStatus = {
  failing: number;
  skipped: number;
  passing: number;
  current: boolean;
};

const RESULT_ORDER: readonly ProofCheck['result'][] = [
  'fail',
  'skipped',
  'pass',
];

export function proofStatus(proof: ReviewProof | undefined): ProofStatus {
  const checks = proof?.checks ?? [];
  const count = (result: ProofCheck['result']) =>
    checks.filter((check) => check.result === result).length;
  return {
    failing: count('fail'),
    skipped: count('skipped'),
    passing: count('pass'),
    current: proof?.current ?? true,
  };
}

export function orderedChecks(checks: readonly ProofCheck[]): ProofCheck[] {
  return checks.toSorted(
    (left, right) =>
      RESULT_ORDER.indexOf(left.result) - RESULT_ORDER.indexOf(right.result),
  );
}

export function proofOnLayer(
  proof: ReviewProof | undefined,
  layerId: string,
): ReviewProof {
  const onLayer = (item: { layerId?: string | undefined }) =>
    item.layerId === layerId;
  return {
    checks: (proof?.checks ?? []).filter(onLayer),
    assets: (proof?.assets ?? []).filter(onLayer),
    current: proof?.current ?? true,
  };
}

export function proofLabel(status: ProofStatus): string {
  const total = status.failing + status.skipped + status.passing;
  if (total === 0) return 'no checks';
  if (status.failing > 0) return `${status.failing} failing`;
  if (!status.current) return 'outdated';
  if (status.skipped > 0) return `${status.skipped} skipped`;
  return total === 1 ? 'passed' : `all ${total} passed`;
}

export function checkResultLabel(result: ProofCheck['result']): string {
  switch (result) {
    case 'fail':
      return 'Failed';
    case 'skipped':
      return 'Skipped';
    case 'pass':
      return 'Passed';
  }
}

export function proofFileBytes(file: ProofFile): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(file.base64), (character) =>
    character.charCodeAt(0),
  );
}

export function linkHost(url: string): string {
  return URL.parse(url)?.host ?? url;
}

export function publishedLabel(publishedAt: string): string {
  return new Date(publishedAt).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
