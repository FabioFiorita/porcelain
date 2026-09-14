import type { EvidenceResponse } from '@porcelain/contracts/evidence';
import type { Application } from '../../application.ts';

export function toEvidenceResponse(
  result: Awaited<ReturnType<Application['reviewEvidence']>>,
): EvidenceResponse {
  return {
    environmentId: result.environmentId,
    worktreeId: result.worktreeId,
    statusToken: result.statusToken,
    consistency: 'best-effort',
    evidence: result.evidence.map((entry) => ({
      path: entry.path,
      fingerprint: entry.fingerprint,
      comparisons: entry.comparisons.map((comparison) => ({
        change: comparison.change,
        content:
          comparison.content.kind === 'diff'
            ? { kind: 'diff', content: comparison.content.content }
            : comparison.content.kind === 'file'
              ? {
                  kind: 'file',
                  encoding: comparison.content.encoding,
                  byteLength: comparison.content.byteLength,
                  text: comparison.content.text,
                }
              : comparison.content,
      })),
    })),
  };
}
