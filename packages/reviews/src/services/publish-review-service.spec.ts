import { InvalidLineRangeError } from '@porcelain/kernel/errors';
import { describe, expect, it } from 'vitest';
import {
  FixedClock,
  SequentialIdSource,
  SequentialSecretSource,
} from '@porcelain/kernel/fakes';
import {
  BoxLaneOutOfRangeError,
  DuplicateLayerIdError,
  DuplicateStepIdError,
  ProofFileUnreadableError,
  ProofTooLargeError,
  ReviewConflictError,
  UnknownProofFileError,
  StepLaneOutOfRangeError,
  UnknownArrowBoxError,
  UnknownArrowStepError,
  UnknownProofTargetError,
  UnsupportedProofFileError,
} from '@porcelain/reviews/errors';
import type { FileChange } from '@porcelain/kernel/models';
import type {
  DiagramBox,
  LayerDraft,
  ProofFileReads,
  ReviewDraft,
  ReviewEvidence,
} from '@porcelain/reviews/models';
import { changesDigest } from '@porcelain/reviews/rules';
import { InMemoryReviewStore } from '../../spec/fakes/in-memory-review-store.ts';
import { PublishReviewService } from './publish-review-service.ts';

const worktreeId = 'a'.repeat(64);
const styled = '<style>h1{color:red}</style><h1>Summary</h1>';
const readme = 'first\nsecond\nadded\n';
const modified: FileChange = {
  path: 'README.md',
  fingerprint: 'f',
  comparisons: [
    {
      scope: 'unstaged',
      kind: 'modified',
      oldPath: 'README.md',
      newPath: 'README.md',
      oldMode: '100644',
      newMode: '100644',
      oldOid: undefined,
      newOid: undefined,
      supported: true,
    },
  ],
};

function evidence(texts: [string, string][] = []): ReviewEvidence {
  return { changes: [], texts: new Map(texts), diffs: [] };
}

const stillChanged: ReviewEvidence = {
  changes: [modified],
  texts: new Map([['README.md', readme]]),
  diffs: [
    {
      selection: {
        scope: 'unstaged',
        oldPath: 'README.md',
        newPath: 'README.md',
      },
      content: { kind: 'text', patch: '@@ -1,0 +2,2 @@\n+second\n+added\n' },
    },
  ],
};

function layer(overrides: Partial<LayerDraft> = {}): LayerDraft {
  return {
    id: 'layer-1',
    title: 'Readme',
    summary: 'Adds a line',
    lanes: ['Docs'],
    steps: [
      {
        id: 'step-1',
        lane: 0,
        title: 'New line',
        text: 'A line is added',
        kind: 'changed',
        pointer: { path: 'README.md', startLine: 2, endLine: 3 },
      },
    ],
    ...overrides,
  };
}

function draft(overrides: Partial<ReviewDraft> = {}): ReviewDraft {
  return {
    expectedRevision: 0,
    summaryHtml: styled,
    layers: [layer()],
    ...overrides,
  };
}

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);
const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86]);
const svg = new TextEncoder().encode(
  '<svg xmlns="http://www.w3.org/2000/svg"/>',
);

function reads(
  files: [string, Uint8Array][],
  tooLarge: string[] = [],
): ProofFileReads {
  return { files: new Map(files), tooLarge };
}

function setup(totalBytes = 1024) {
  const store = new InMemoryReviewStore();
  const service = new PublishReviewService(
    store,
    new FixedClock('2026-01-01T00:00:00.000Z'),
    new SequentialIdSource(),
    new SequentialSecretSource(),
    { totalBytes, signatureBytes: 16 },
  );
  return { store, service };
}

describe('PublishReviewService', () => {
  it('publishes the first review at revision one with the lines each step points at', () => {
    const { service, store } = setup();
    const { review, warnings } = service.execute({
      worktreeId,
      draft: draft(),
      evidence: stillChanged,
    });
    expect(review).toMatchObject({
      worktreeId,
      revision: 1,
      publishedAt: '2026-01-01T00:00:00.000Z',
      active: true,
      summaryHtml: styled,
    });
    expect(review.layers[0]?.steps[0]?.published).toEqual(['second', 'added']);
    expect(warnings).toEqual([]);
    expect(store.read({ worktreeId })).toEqual(review);
  });

  it('stores the first review inactive when every line it explains is already committed', () => {
    const { service, store } = setup();
    const { review } = service.execute({
      worktreeId,
      draft: draft(),
      evidence: evidence([['README.md', readme]]),
    });
    expect(review.active).toBe(false);
    expect(store.read({ worktreeId })?.active).toBe(false);
  });

  it('keeps no lines for a step whose file could not be read or whose range runs past the file', () => {
    const { service } = setup();
    const past = layer({
      id: 'layer-2',
      steps: [
        {
          id: 'step-2',
          lane: 0,
          title: 'Past the end',
          text: 'Points too far',
          kind: 'context',
          pointer: { path: 'README.md', startLine: 3, endLine: 4 },
        },
      ],
    });
    const { review } = service.execute({
      worktreeId,
      draft: draft({ layers: [layer(), past] }),
      evidence: evidence(),
    });
    expect(review.layers.map((entry) => entry.steps[0]?.published)).toEqual([
      [],
      [],
    ]);
    expect(
      setup().service.execute({
        worktreeId,
        draft: draft({ layers: [past] }),
        evidence: evidence([['README.md', readme]]),
      }).review.layers[0]?.steps[0]?.published,
    ).toEqual([]);
  });

  it('replaces the review when the publisher states the current revision, with a fresh summary link', () => {
    const { service } = setup();
    const first = service.execute({
      worktreeId,
      draft: draft(),
      evidence: evidence(),
    });
    const second = service.execute({
      worktreeId,
      draft: draft({ expectedRevision: 1 }),
      evidence: evidence(),
    });
    expect(second.review.revision).toBe(2);
    expect(second.review.summaryToken).not.toBe(first.review.summaryToken);
  });

  it.each([
    { name: 'an older revision', expectedRevision: 0 },
    { name: 'a revision it has not reached', expectedRevision: 2 },
  ])(
    'refuses a publish that states $name and keeps the stored review',
    ({ expectedRevision }) => {
      const { service, store } = setup();
      service.execute({ worktreeId, draft: draft(), evidence: evidence() });
      expect(() =>
        service.execute({
          worktreeId,
          draft: draft({ expectedRevision, summaryHtml: '<p>Other</p>' }),
          evidence: evidence(),
        }),
      ).toThrow(ReviewConflictError);
      expect(store.read({ worktreeId })?.summaryHtml).toBe(styled);
    },
  );

  const box: DiagramBox = {
    id: 'box-1',
    lane: 0,
    label: 'API',
    kind: 'component',
  };
  it.each<{ name: string; refused: ReviewDraft; error: new () => Error }>([
    {
      name: 'two layers with one id',
      refused: draft({ layers: [layer(), layer()] }),
      error: DuplicateLayerIdError,
    },
    {
      name: 'two steps with one id',
      refused: draft({
        layers: [layer({ steps: [...layer().steps, ...layer().steps] })],
      }),
      error: DuplicateStepIdError,
    },
    {
      name: 'a step pointing at lines that end before they start',
      refused: draft({
        layers: [
          layer({
            steps: [
              {
                id: 'step-1',
                lane: 0,
                title: 'Backwards',
                text: 'Ends before it starts',
                kind: 'changed',
                pointer: { path: 'README.md', startLine: 3, endLine: 2 },
              },
            ],
          }),
        ],
      }),
      error: InvalidLineRangeError,
    },
    {
      name: 'a step on a lane the layer does not have',
      refused: draft({ layers: [layer({ lanes: [] })] }),
      error: StepLaneOutOfRangeError,
    },
    {
      name: 'a layer arrow to an unknown step',
      refused: draft({
        layers: [layer({ arrows: [{ from: 'step-1', to: 'step-9' }] })],
      }),
      error: UnknownArrowStepError,
    },
    {
      name: 'a box on a lane the diagram does not have',
      refused: draft({
        diagram: {
          after: { lanes: [], boxes: [box], arrows: [] },
        },
      }),
      error: BoxLaneOutOfRangeError,
    },
    {
      name: 'a check on a layer the review does not have',
      refused: draft({
        proof: { checks: [{ name: 'Tests', result: 'pass', layerId: 'x' }] },
      }),
      error: UnknownProofTargetError,
    },
    {
      name: 'an asset on a step its layer does not have',
      refused: draft({
        proof: {
          assets: [
            {
              kind: 'link',
              title: 'Run',
              url: 'https://ci.example/run/1',
              layerId: 'layer-1',
              stepId: 'step-9',
            },
          ],
        },
      }),
      error: UnknownProofTargetError,
    },
    {
      name: 'a check on a step without its layer',
      refused: draft({
        proof: {
          checks: [{ name: 'Tests', result: 'fail', stepId: 'step-1' }],
        },
      }),
      error: UnknownProofTargetError,
    },
    {
      name: 'a diagram arrow to an unknown box',
      refused: draft({
        diagram: {
          after: {
            lanes: ['Server'],
            boxes: [box],
            arrows: [{ from: 'box-1', to: 'box-9' }],
          },
        },
      }),
      error: UnknownArrowBoxError,
    },
  ])('refuses a draft with $name and stores nothing', ({ refused, error }) => {
    const { service, store } = setup();
    expect(() =>
      service.execute({ worktreeId, draft: refused, evidence: evidence() }),
    ).toThrow(error);
    expect(store.read({ worktreeId })).toBeUndefined();
  });

  it('warns when the summary carries no authored CSS but still publishes', () => {
    const { service, store } = setup();
    const { warnings } = service.execute({
      worktreeId,
      draft: draft({ summaryHtml: '<h1>Summary</h1>' }),
      evidence: evidence(),
    });
    expect(warnings).toEqual(['missing-style']);
    expect(store.read({ worktreeId })?.revision).toBe(1);
  });

  it('publishes checks as given and keeps each attached file under its own id with the type its bytes show', () => {
    const { service, store } = setup();
    const { review } = service.execute({
      worktreeId,
      draft: draft({
        proof: {
          checks: [
            { name: 'Unit tests', result: 'pass' },
            {
              name: 'Browser journey',
              result: 'fail',
              output: 'expected 2, got 3',
              layerId: 'layer-1',
              stepId: 'step-1',
            },
          ],
          assets: [
            { kind: 'image', title: 'Screenshot', path: 'shot.png' },
            {
              kind: 'video',
              title: 'Recording',
              path: 'run.webm',
              layerId: 'layer-1',
            },
            { kind: 'link', title: 'CI run', url: 'https://ci.example/run/1' },
          ],
        },
      }),
      evidence: evidence(),
      proofFiles: reads([
        ['shot.png', png],
        ['run.webm', webm],
      ]),
    });
    const [image, video, link] = review.proof?.assets ?? [];
    expect(review.proof).toEqual({
      checks: [
        { name: 'Unit tests', result: 'pass' },
        {
          name: 'Browser journey',
          result: 'fail',
          output: 'expected 2, got 3',
          layerId: 'layer-1',
          stepId: 'step-1',
        },
      ],
      assets: [
        {
          id: image?.id,
          kind: 'image',
          title: 'Screenshot',
          mediaType: 'image/png',
          byteLength: png.byteLength,
        },
        {
          id: video?.id,
          kind: 'video',
          title: 'Recording',
          mediaType: 'video/webm',
          byteLength: webm.byteLength,
          layerId: 'layer-1',
        },
        {
          id: link?.id,
          kind: 'link',
          title: 'CI run',
          url: 'https://ci.example/run/1',
        },
      ],
      baseline: {
        digest: changesDigest([], ['shot.png', 'run.webm']),
        proofPaths: ['shot.png', 'run.webm'],
      },
    });
    expect(new Set([image?.id, video?.id, link?.id]).size).toBe(3);
    expect(store.read({ worktreeId })?.proof).toEqual(review.proof);
    expect(
      store.readProofFile({ worktreeId, proofId: image?.id ?? '' }),
    ).toEqual({ id: image?.id, mediaType: 'image/png', bytes: png });
    expect(
      store.readProofFile({ worktreeId, proofId: video?.id ?? '' }),
    ).toEqual({ id: video?.id, mediaType: 'video/webm', bytes: webm });
    expect(
      store.readProofFile({ worktreeId, proofId: link?.id ?? '' }),
    ).toBeUndefined();
  });

  it('drops the previous proof files when a later publish attaches none', () => {
    const { service, store } = setup();
    const first = service.execute({
      worktreeId,
      draft: draft({
        proof: { assets: [{ kind: 'image', title: 'Shot', path: 'shot.png' }] },
      }),
      evidence: evidence(),
      proofFiles: reads([['shot.png', png]]),
    });
    const proofId = first.review.proof?.assets[0]?.id ?? '';
    expect(store.readProofFile({ worktreeId, proofId })).toEqual({
      id: proofId,
      mediaType: 'image/png',
      bytes: png,
    });
    const second = service.execute({
      worktreeId,
      draft: draft({ expectedRevision: 1 }),
      evidence: evidence(),
    });
    expect(second.review.proof).toBeUndefined();
    expect(store.readProofFile({ worktreeId, proofId })).toBeUndefined();
  });

  it.each<{
    name: string;
    kind: 'image' | 'video';
    proofFiles: ProofFileReads;
    error: new () => Error;
  }>([
    {
      name: 'an image path the worktree does not hold',
      kind: 'image',
      proofFiles: reads([]),
      error: ProofFileUnreadableError,
    },
    {
      name: 'an image whose bytes are an SVG document',
      kind: 'image',
      proofFiles: reads([['proof', svg]]),
      error: UnsupportedProofFileError,
    },
    {
      name: 'a video whose bytes are a PNG image',
      kind: 'video',
      proofFiles: reads([['proof', png]]),
      error: UnsupportedProofFileError,
    },
    {
      name: 'an empty file',
      kind: 'image',
      proofFiles: reads([['proof', new Uint8Array()]]),
      error: UnsupportedProofFileError,
    },
    {
      name: 'a file the reader stopped at its size limit',
      kind: 'image',
      proofFiles: reads([], ['proof']),
      error: ProofTooLargeError,
    },
  ])(
    'refuses $name and keeps the stored review',
    ({ kind, proofFiles, error }) => {
      const { service, store } = setup();
      service.execute({ worktreeId, draft: draft(), evidence: evidence() });
      expect(() =>
        service.execute({
          worktreeId,
          draft: draft({
            expectedRevision: 1,
            proof: { assets: [{ kind, title: 'Proof', path: 'proof' }] },
          }),
          evidence: evidence(),
          proofFiles,
        }),
      ).toThrow(error);
      expect(store.read({ worktreeId })?.revision).toBe(1);
    },
  );

  it('refuses files that fit one by one but not together', () => {
    const { service, store } = setup(png.byteLength * 2 - 1);
    expect(() =>
      service.execute({
        worktreeId,
        draft: draft({
          proof: {
            assets: [
              { kind: 'image', title: 'One', path: 'one.png' },
              { kind: 'image', title: 'Two', path: 'two.png' },
            ],
          },
        }),
        evidence: evidence(),
        proofFiles: reads([
          ['one.png', png],
          ['two.png', png],
        ]),
      }),
    ).toThrow(ProofTooLargeError);
    expect(store.read({ worktreeId })).toBeUndefined();
  });

  it('keeps a published file when the next publish names it by its proof id', () => {
    const { service, store } = setup();
    const first = service.execute({
      worktreeId,
      draft: draft({
        proof: { assets: [{ kind: 'image', title: 'Shot', path: 'shot.png' }] },
      }),
      evidence: evidence(),
      proofFiles: reads([['shot.png', png]]),
    });
    const kept = first.review.proof?.assets[0]?.id ?? '';
    const second = service.execute({
      worktreeId,
      draft: draft({
        expectedRevision: 1,
        proof: {
          assets: [
            {
              kind: 'image',
              title: 'Same shot',
              proofId: kept,
              layerId: 'layer-1',
            },
          ],
        },
      }),
      evidence: evidence(),
    });
    const asset = second.review.proof?.assets[0];
    expect(asset).toEqual({
      id: asset?.id,
      kind: 'image',
      title: 'Same shot',
      mediaType: 'image/png',
      byteLength: png.byteLength,
      layerId: 'layer-1',
    });
    expect(
      store.readProofFile({ worktreeId, proofId: asset?.id ?? '' }),
    ).toEqual({ id: asset?.id, mediaType: 'image/png', bytes: png });
  });

  it.each([
    {
      name: 'a proof id the review does not hold',
      kind: 'image' as const,
      known: false,
    },
    {
      name: 'a kept image named as a video',
      kind: 'video' as const,
      known: true,
    },
  ])('refuses $name and keeps the stored review', ({ kind, known }) => {
    const { service, store } = setup();
    const first = service.execute({
      worktreeId,
      draft: draft({
        proof: { assets: [{ kind: 'image', title: 'Shot', path: 'shot.png' }] },
      }),
      evidence: evidence(),
      proofFiles: reads([['shot.png', png]]),
    });
    const proofId = known
      ? (first.review.proof?.assets[0]?.id ?? '')
      : 'no-such-proof';
    expect(() =>
      service.execute({
        worktreeId,
        draft: draft({
          expectedRevision: 1,
          proof: { assets: [{ kind, title: 'Shot', proofId }] },
        }),
        evidence: evidence(),
      }),
    ).toThrow(known ? UnsupportedProofFileError : UnknownProofFileError);
    expect(store.read({ worktreeId })?.revision).toBe(1);
  });
});
