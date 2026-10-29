import { expect, it } from 'vitest';
import {
  revisionReviewItems,
  revisionDecisionStates,
  revisionDecisionProgress,
} from './revision.ts';

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

it.for([
  {
    name: 'no marks',
    file: false,
    decision: false,
    fingerprint: 'blob',
    expected: 0,
  },
  {
    name: 'a decision mark and no file mark',
    file: false,
    decision: true,
    fingerprint: 'blob',
    expected: 1,
  },
  {
    name: 'file without decision',
    file: true,
    decision: false,
    fingerprint: 'blob',
    expected: 0,
  },
  {
    name: 'both current marks',
    file: true,
    decision: true,
    fingerprint: 'blob',
    expected: 1,
  },
  {
    name: 'a marked decision whose file changed since it was reviewed',
    file: true,
    decision: true,
    fingerprint: 'old',
    expected: 1,
  },
])(
  'counts completed decisions with $name',
  ({ file, decision, fingerprint, expected }) => {
    const revision = {
      files: [
        {
          path: 'owner.ts',
          newOid: 'blob',
          oldMode: '100644',
          newMode: '100644',
          status: 'added' as const,
        },
      ],
      content: {
        notExplained: [],
        layers: [
          {
            id: 'decision',
            title: 'Own the behavior',
            summary: 'One owner',
            lanes: ['Owner'],
            fingerprint: 'layer',
            steps: [
              {
                id: 'step',
                lane: 0,
                title: 'Implement it',
                text: 'Change the owner',
                kind: 'changed' as const,
                pointer: {
                  path: 'owner.ts',
                  startLine: 1,
                  endLine: 1,
                  textFingerprint: 'text',
                },
                location: {
                  state: 'current' as const,
                  startLine: 1,
                  endLine: 1,
                },
              },
            ],
          },
        ],
      },
    };
    const marks = {
      files: file
        ? [{ path: 'owner.ts', fingerprint, reviewedAt: 'now', stale: false }]
        : [],
      decisions: decision
        ? [{ layerId: 'decision', fingerprint: 'layer', reviewedAt: 'now' }]
        : [],
    };
    expect(
      revisionDecisionProgress(revision, marks, { specsApart: false }),
    ).toEqual({ reviewed: expected, total: 1 });
  },
);

const anchored = { startLine: 3, endLine: 4 };
const locations = {
  current: { state: 'current' as const, ...anchored },
  committed: { state: 'committed' as const, ...anchored },
  changed: { state: 'changed' as const },
  broken: { state: 'broken' as const },
};

function decisionAt(
  id: string,
  steps: readonly (keyof typeof locations)[],
  path = 'owner.ts',
) {
  return {
    id,
    title: 'Own the behavior',
    summary: 'One owner',
    lanes: ['Owner'],
    fingerprint: `${id}-layer`,
    steps: steps.map((state, index) => ({
      id: `${id}-${index}`,
      lane: 0,
      title: 'Point at the owner',
      text: 'The owner changed here',
      kind: index === 0 ? ('changed' as const) : ('context' as const),
      pointer: {
        path,
        startLine: 3,
        endLine: 4,
        textFingerprint: 'text',
      },
      location: locations[state],
    })),
  };
}

it.for([
  { name: 'fresh lines', steps: ['current'] as const, stale: false },
  { name: 'committed lines', steps: ['committed'] as const, stale: false },
  { name: 'moved lines', steps: ['changed'] as const, stale: true },
  { name: 'deleted lines', steps: ['broken'] as const, stale: true },
  {
    name: 'one moved step among fresh ones',
    steps: ['current', 'committed', 'changed'] as const,
    stale: true,
  },
  {
    name: 'a whole deleted file',
    steps: ['broken', 'broken'] as const,
    stale: true,
  },
])('reports code moved for $name', ({ steps, stale }) => {
  const states = revisionDecisionStates(
    { content: { layers: [decisionAt('decision', steps)] } },
    undefined,
  );
  expect(states.get('decision')).toEqual({ reviewed: false, stale });
});

it('reads code moved from each revision on its own and keeps it apart from the review mark', () => {
  const marks = {
    files: [],
    decisions: [
      { layerId: 'decision', fingerprint: 'decision-layer', reviewedAt: 'r1' },
    ],
  };
  const first = { content: { layers: [decisionAt('decision', ['current'])] } };
  const second = {
    content: {
      layers: [
        decisionAt('decision', ['changed']),
        decisionAt('other', ['current'], 'other.ts'),
      ],
    },
  };
  expect([...revisionDecisionStates(first, marks)]).toEqual([
    ['decision', { reviewed: true, stale: false }],
  ]);
  expect([...revisionDecisionStates(second, marks)]).toEqual([
    ['decision', { reviewed: true, stale: true }],
    ['other', { reviewed: false, stale: false }],
  ]);
});
