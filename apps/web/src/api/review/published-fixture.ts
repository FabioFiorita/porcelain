import type { ReviewResponse } from '@porcelain/contracts/review';

export function publishedReviewFixture(
  worktreeId: string,
  environmentId: string,
): ReviewResponse {
  return {
    environmentId,
    worktreeId,
    revision: 1,
    publishedAt: '2026-09-21T12:00:00.000Z',
    active: true,
    diagnostics: 'current',
    summary: {
      url: 'data:text/html,%3Ch1%3EReview%20summary%3C%2Fh1%3E',
      byteLength: 23,
    },
    layers: [
      {
        id: 'bf4f1c6b-2b54-423b-a9b5-7c40112b3101',
        title: 'A clearer review experience',
        summary:
          'Explain the review panel from its input to the rendered result.',
        lanes: ['View'],
        fingerprint: 'a'.repeat(64),
        steps: [
          {
            id: 'bf4f1c6b-2b54-423b-a9b5-7c40112b3201',
            lane: 0,
            title: 'ReviewPanel',
            text: 'Render the review title and guidance.',
            kind: 'changed',
            pointer: {
              path: 'src/components/review-panel.tsx',
              startLine: 3,
              endLine: 11,
              symbol: 'ReviewPanel',
              textFingerprint: 'b'.repeat(64),
            },
            location: { state: 'current', startLine: 3, endLine: 11 },
          },
        ],
      },
    ],
    notExplained: [
      { path: 'src/styles/theme.css', ranges: [{ startLine: 1, endLine: 3 }] },
    ],
  };
}
