import { expect, it } from 'vitest';
import { revisionReviewItems, revisionDecisionStates } from './revision.ts';

it('uses head blobs for file marks, retaining unchanged marks across revisions and using the retained old blob for a deletion', () => {
  const revision = {
    files: [
      {
        path: 'same.ts',
        newOid: 'same',
        oldMode: '100644',
        newMode: '100644',
        status: 'modified' as const,
      },
      {
        path: 'changed.ts',
        newOid: 'new',
        oldMode: '100644',
        newMode: '100644',
        status: 'modified' as const,
      },
      {
        path: 'gone.ts',
        oldOid: 'gone',
        oldMode: '100644',
        newMode: '000000',
        status: 'deleted' as const,
      },
    ],
  };
  expect(
    revisionReviewItems(revision, {
      decisions: [],
      files: [
        {
          path: 'same.ts',
          fingerprint: 'same',
          reviewedAt: '2026-10-19T12:00:00Z',
          stale: false,
        },
        {
          path: 'changed.ts',
          fingerprint: 'old',
          reviewedAt: '2026-10-19T12:00:00Z',
          stale: true,
        },
        {
          path: 'gone.ts',
          fingerprint: 'gone',
          reviewedAt: '2026-10-19T12:00:00Z',
          stale: false,
        },
      ],
    }),
  ).toEqual([
    { path: 'same.ts', fingerprint: 'same', reviewStatus: 'reviewed' },
    { path: 'changed.ts', fingerprint: 'new', reviewStatus: 'unreviewed' },
    { path: 'gone.ts', fingerprint: 'gone', reviewStatus: 'reviewed' },
  ]);
  expect(
    revisionReviewItems(revision, undefined).every(
      (file) => file.reviewStatus === 'unreviewed',
    ),
  ).toBe(true);
});

it('matches immutable decisions against all retained marks by both layer and fingerprint', () => {
  const layer = {
    id: 'decision',
    fingerprint: 'new',
    title: 'Owner',
    summary: '',
    lanes: [],
    steps: [],
  };
  const revision = {
    content: {
      layers: [layer, { ...layer, id: 'another' }, { ...layer, id: 'never' }],
    },
  };
  const states = revisionDecisionStates(revision, {
    files: [],
    decisions: [
      { layerId: 'decision', fingerprint: 'old', reviewedAt: 'old' },
      { layerId: 'decision', fingerprint: 'new', reviewedAt: 'new' },
      { layerId: 'another', fingerprint: 'old', reviewedAt: 'old' },
    ],
  });
  expect([...states]).toEqual([
    ['decision', { reviewed: true, stale: false }],
    ['another', { reviewed: false, stale: false }],
    ['never', { reviewed: false, stale: false }],
  ]);
  expect(revisionDecisionStates(revision, undefined).get('decision')).toEqual({
    reviewed: false,
    stale: false,
  });
});
