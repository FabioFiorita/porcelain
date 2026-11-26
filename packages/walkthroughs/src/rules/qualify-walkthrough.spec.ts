import { expect, it } from 'vite-plus/test';
import type { WalkthroughBlockRequest } from '../models/blocks.ts';
import type {
  WalkthroughDraft,
  WalkthroughEvidence,
  WalkthroughJob,
} from '../models/walkthrough.ts';
import { capturedExcerpt } from './captured-excerpt.ts';
import { qualifyWalkthrough } from './qualify-walkthrough.ts';

const job: WalkthroughJob = {
  worktreePath: '/repo',
  patch: [
    'diff --git a/before.ts b/owner.ts',
    'similarity index 75%',
    'rename from before.ts',
    'rename to owner.ts',
    '--- a/before.ts',
    '+++ b/owner.ts',
    '@@ -1,3 +1,3 @@',
    ' context',
    '-old',
    '+new',
    ' tail',
    '',
  ].join('\n'),
  files: [
    {
      path: 'owner.ts',
      oldPath: 'before.ts',
      hunks: [{ oldStart: 1, oldEnd: 3, newStart: 1, newEnd: 3 }],
    },
    { path: 'support.ts', hunks: [] },
  ],
  run: {
    id: 'fixture',
    projectId: 'project',
    worktreeId: 'tree',
    baseOid: 'base',
    baseRef: 'main',
    headOid: 'head',
    contentTreeOid: 'tree',
    includesUncommitted: true,
    writer: { provider: 'codex', model: 'model', effort: 'medium' },
    createdAt: 'today',
    state: { status: 'running' },
  },
};

const evidence: WalkthroughEvidence = {
  title: 'A renamed file',
  body: '',
  assets: ['before', 'after'].map((id) => ({
    id,
    bytes: new Uint8Array([137, 80, 78, 71]),
    mediaType: 'image/png',
    caption: 'Existing image',
  })),
  checks: {
    state: 'SUCCESS',
    checksTruncated: false,
    results: [{ name: 'Test', status: 'SUCCESS' }],
  },
};
const oldExcerpt = {
  kind: 'diff_excerpt',
  path: 'before.ts',
  side: 'old',
  start: 2,
  end: 2,
  caption: 'Previous value',
} as const;
const images = {
  kind: 'before_after',
  before: { assetId: 'before', shows: 'Previous behavior' },
  after: { assetId: 'after', shows: 'Current behavior' },
} as const;
const stop = (title: string, ...blocks: WalkthroughBlockRequest[]) => ({
  title,
  explanation: 'What the captured change does.',
  blocks,
});
const content: WalkthroughDraft = {
  version: 1,
  outcome: 'needs_you',
  title: 'The change',
  summary: 'A new owner.',
  growth: [],
  stops: [],
  onlyInTranscript: [],
  stillUnclear: ['Unknown'],
};

it('keeps captured lines and real PR evidence, and drops blocks that cite unavailable data', () => {
  const result = qualifyWalkthrough(
    {
      ...content,
      stops: [
        stop(
          'One owner',
          { ...oldExcerpt, start: 4, end: 5 },
          oldExcerpt,
          { ...oldExcerpt, path: 'owner.ts' },
          { kind: 'files', files: [{ path: 'unknown.ts', note: 'Invented' }] },
          { ...images, before: { assetId: 'unknown', shows: 'Invented' } },
          { ...images, after: images.before },
          images,
          { kind: 'checks', headOid: 'another-head' },
          { kind: 'checks', headOid: 'head' },
          {
            kind: 'callout',
            attention: {
              kind: 'risk',
              note: 'Affects existing readers',
              question: 'Keep both names?',
            },
            comparison: {
              columns: ['Keep', 'Replace'],
              rows: [['Two names', 'One name']],
            },
          },
        ),
        stop('Same file twice', oldExcerpt),
      ],
    },
    job,
    evidence,
  );
  expect(result.outcome).toBe('needs_you');
  expect(result.stops[0]?.blocks).toEqual([
    { ...oldExcerpt, headOid: 'head', contentTreeOid: 'tree' },
    images,
    {
      kind: 'checks',
      headOid: 'head',
      state: 'SUCCESS',
      checksTruncated: false,
      results: [{ name: 'Test', status: 'SUCCESS' }],
    },
    {
      kind: 'callout',
      attention: {
        kind: 'risk',
        note: 'Affects existing readers',
        question: 'Keep both names?',
      },
      comparison: {
        columns: ['Keep', 'Replace'],
        rows: [['Two names', 'One name']],
      },
    },
  ]);
  expect(result.stops[1]?.blocks).toEqual([]);
  expect(result.stops[2]).toEqual({
    title: 'Everything else',
    explanation: 'These changed files complete the change.',
    blocks: [
      {
        kind: 'files',
        files: [{ path: 'support.ts', note: 'Supporting change' }],
      },
    ],
  });
  const ready: WalkthroughJob = {
    ...job,
    run: {
      ...job.run,
      state: {
        status: 'ready',
        content: result,
        writtenAt: 'today',
        durationMs: 1,
      },
    },
  };
  expect(capturedExcerpt(ready, 1, 1)).toContain(
    '@@ -1,3 +1,3 @@\n context\n-old\n+new',
  );
  expect(capturedExcerpt(ready, 1, 2)).toBeUndefined();
});

it('leaves a step readable with no evidence when the patch and PR cannot confirm it', () => {
  const result = qualifyWalkthrough(
    {
      ...content,
      stops: [
        stop('One owner', oldExcerpt, images, {
          kind: 'checks',
          headOid: 'head',
        }),
      ],
    },
    { ...job, patch: '' },
    { ...evidence, unavailable: 'head_mismatch' },
  );
  expect(result.outcome).toBe('worth_knowing');
  expect(result.stops[0]).toEqual(stop('One owner'));
});

it('requires no coverage and hides unanswered questions for nothing', () => {
  const result = qualifyWalkthrough(
    { ...content, outcome: 'nothing', stops: [stop('One owner')] },
    job,
    evidence,
  );
  expect(result.stops).toEqual([]);
  expect(result.stillUnclear).toEqual([]);
});

it('merges leftover files into a writer-supplied Everything else stop', () => {
  const result = qualifyWalkthrough(
    {
      ...content,
      stops: [
        stop('One owner'),
        stop('Everything else', {
          kind: 'files',
          files: [{ path: 'owner.ts', note: 'Writer note' }],
        }),
      ],
    },
    job,
    evidence,
  );
  expect(result.stops.map((item) => item.title)).toEqual([
    'One owner',
    'Everything else',
  ]);
  expect(result.stops[1]?.blocks).toEqual([
    { kind: 'files', files: [{ path: 'owner.ts', note: 'Writer note' }] },
    {
      kind: 'files',
      files: [{ path: 'support.ts', note: 'Supporting change' }],
    },
  ]);
});

it('numbers repeated stop titles without taking another step title', () => {
  const result = qualifyWalkthrough(
    {
      ...content,
      stops: ['Same', 'Same', 'Same (2)', 'Same'].map((title) => stop(title)),
    },
    { ...job, files: [] },
    evidence,
  );
  expect(result.stops.map((item) => item.title)).toEqual([
    'Same',
    'Same (3)',
    'Same (2)',
    'Same (4)',
  ]);
});

it('keeps a detailed excerpt after a file overview and identifies the captured working tree', () => {
  const overview = {
    kind: 'files',
    files: [{ path: 'owner.ts', note: 'The moved file' }],
  } as const;
  const result = qualifyWalkthrough(
    {
      ...content,
      stops: [stop('Overview', overview), stop('Details', oldExcerpt)],
    },
    job,
    evidence,
  );
  expect(result.stops[0]?.blocks).toEqual([overview]);
  expect(result.stops[1]?.blocks).toEqual([
    { ...oldExcerpt, headOid: 'head', contentTreeOid: 'tree' },
  ]);
});

const decision = {
  kind: 'callout',
  attention: {
    kind: 'risk',
    note: 'Affects existing readers',
    question: 'Keep both names?',
  },
} as const;

it.each([
  { ...decision, attention: { ...decision.attention, note: ' ' } },
  { ...decision, attention: { ...decision.attention, question: '' } },
  {
    ...decision,
    comparison: { columns: ['A', 'B', 'C'], rows: [['Yes', 'No']] },
  },
  {
    ...decision,
    comparison: {
      columns: ['A', 'B'],
      rows: Array.from({ length: 7 }, () => ['Yes', 'No']),
    },
  },
  { ...decision, comparison: { columns: ['A', 'B'], rows: [['Yes']] } },
])('omits an unusable callout', (block) => {
  const result = qualifyWalkthrough(
    { ...content, stops: [stop('Decision', block)] },
    job,
    evidence,
  );
  expect(result.stops[0]?.blocks).toEqual([]);
  expect(result.outcome).toBe('worth_knowing');
});

it.each([
  { implemented: 'Keep', kept: 'Keep' },
  { implemented: 'Rename everything', kept: undefined },
])(
  'keeps the option a change implements only when it is one of the columns: $implemented',
  ({ implemented, kept }) => {
    const result = qualifyWalkthrough(
      {
        ...content,
        stops: [
          stop('Decision', {
            ...decision,
            comparison: {
              columns: ['Keep', 'Replace'],
              rows: [['Two names', 'One name']],
              implemented,
            },
          }),
        ],
      },
      job,
      evidence,
    );
    expect(result.stops[0]?.blocks).toEqual([
      {
        ...decision,
        comparison: {
          columns: ['Keep', 'Replace'],
          rows: [['Two names', 'One name']],
          ...(kept === undefined ? {} : { implemented: kept }),
        },
      },
    ]);
  },
);
