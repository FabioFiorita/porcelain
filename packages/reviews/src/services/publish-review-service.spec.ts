import { Clock, IdSource, SecretSource } from '@porcelain/kernel/ports';
import { ReviewStore, ProofLimits } from '@porcelain/reviews/ports';
import { ValidateReviewDraftService } from '@porcelain/reviews/services';
import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import {
  FixedClock,
  SequentialIdSource,
  SequentialSecretSource,
} from '@porcelain/kernel/fakes';
import {
  ProofFileUnreadableError,
  ProofTooLargeError,
  ReviewConflictError,
  UnknownProofFileError,
  UnsupportedProofFileError,
} from '@porcelain/reviews/errors';
import { type FileChange } from '@porcelain/kernel/models';
import {
  type LayerDraft,
  type ProofFileReads,
  type ReviewDraft,
  type ValidatedReviewDraft,
  type ReviewEvidence,
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

function draft(overrides: Partial<ReviewDraft> = {}): ValidatedReviewDraft {
  return Effect.runSync(
    Effect.runSync(
      ValidateReviewDraftService.pipe(
        Effect.provide(ValidateReviewDraftService.layer),
      ),
    ).execute({
      expectedRevision: 0,
      summaryHtml: styled,
      layers: [layer()],
      ...overrides,
    }),
  );
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
  const service = Effect.runSync(
    PublishReviewService.pipe(
      Effect.provide(PublishReviewService.layer),
      Effect.provideService(ReviewStore, store),
      Effect.provideService(Clock, new FixedClock('2026-01-01T00:00:00.000Z')),
      Effect.provideService(IdSource, new SequentialIdSource()),
      Effect.provideService(SecretSource, new SequentialSecretSource()),
      Effect.provideService(ProofLimits, { totalBytes, signatureBytes: 16 }),
    ),
  );
  return { store, service };
}

describe('PublishReviewService', () => {
  it('publishes the first review at revision one with the lines each step points at', async () => {
    const { service, store } = setup();
    const { review, warnings } = Effect.runSync(
      service.execute({
        worktreeId,
        draft: draft(),
        evidence: stillChanged,
      }),
    );
    expect(review).toMatchObject({
      worktreeId,
      revision: 1,
      publishedAt: '2026-01-01T00:00:00.000Z',
      active: true,
      summaryHtml: styled,
    });
    expect(review.layers[0]?.steps[0]?.published).toEqual(['second', 'added']);
    expect(warnings).toEqual([]);
    expect(await Effect.runPromise(store.read({ worktreeId }))).toEqual(review);
  });

  it('stores the first review inactive when every line it explains is already committed', async () => {
    const { service, store } = setup();
    const { review } = Effect.runSync(
      service.execute({
        worktreeId,
        draft: draft(),
        evidence: evidence([['README.md', readme]]),
      }),
    );
    expect(review.active).toBe(false);
    expect((await Effect.runPromise(store.read({ worktreeId })))?.active).toBe(
      false,
    );
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
    const { review } = Effect.runSync(
      service.execute({
        worktreeId,
        draft: draft({ layers: [layer(), past] }),
        evidence: evidence(),
      }),
    );
    expect(review.layers.map((entry) => entry.steps[0]?.published)).toEqual([
      [],
      [],
    ]);
    expect(
      Effect.runSync(
        setup().service.execute({
          worktreeId,
          draft: draft({ layers: [past] }),
          evidence: evidence([['README.md', readme]]),
        }),
      ).review.layers[0]?.steps[0]?.published,
    ).toEqual([]);
  });

  it('replaces the review when the publisher states the current revision, with a fresh summary link', () => {
    const { service } = setup();
    const first = Effect.runSync(
      service.execute({
        worktreeId,
        draft: draft(),
        evidence: evidence(),
      }),
    );
    const second = Effect.runSync(
      service.execute({
        worktreeId,
        draft: draft({ expectedRevision: 1 }),
        evidence: evidence(),
      }),
    );
    expect(second.review.revision).toBe(2);
    expect(second.review.summaryToken).not.toBe(first.review.summaryToken);
  });

  it.each([
    { name: 'an older revision', expectedRevision: 0 },
    { name: 'a revision it has not reached', expectedRevision: 2 },
  ])(
    'refuses a publish that states $name and keeps the stored review',
    async ({ expectedRevision }) => {
      const { service, store } = setup();
      Effect.runSync(
        service.execute({ worktreeId, draft: draft(), evidence: evidence() }),
      );
      expect(() =>
        Effect.runSync(
          service.execute({
            worktreeId,
            draft: draft({ expectedRevision, summaryHtml: '<p>Other</p>' }),
            evidence: evidence(),
          }),
        ),
      ).toThrow(ReviewConflictError);
      expect(
        (await Effect.runPromise(store.read({ worktreeId })))?.summaryHtml,
      ).toBe(styled);
    },
  );

  it('warns when the summary carries no authored CSS but still publishes', async () => {
    const { service, store } = setup();
    const { warnings } = Effect.runSync(
      service.execute({
        worktreeId,
        draft: draft({ summaryHtml: '<h1>Summary</h1>' }),
        evidence: evidence(),
      }),
    );
    expect(warnings).toEqual(['missing-style']);
    expect(
      (await Effect.runPromise(store.read({ worktreeId })))?.revision,
    ).toBe(1);
  });

  it('publishes checks as given and keeps each attached file under its own id with the type its bytes show', async () => {
    const { service, store } = setup();
    const { review } = Effect.runSync(
      service.execute({
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
              {
                kind: 'link',
                title: 'CI run',
                url: 'https://ci.example/run/1',
              },
            ],
          },
        }),
        evidence: evidence(),
        proofFiles: reads([
          ['shot.png', png],
          ['run.webm', webm],
        ]),
      }),
    );
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
    expect(
      (await Effect.runPromise(store.read({ worktreeId })))?.proof,
    ).toEqual(review.proof);
    expect(
      await Effect.runPromise(
        store.readProofFile({ worktreeId, proofId: image?.id ?? '' }),
      ),
    ).toEqual({ id: image?.id, mediaType: 'image/png', bytes: png });
    expect(
      await Effect.runPromise(
        store.readProofFile({ worktreeId, proofId: video?.id ?? '' }),
      ),
    ).toEqual({ id: video?.id, mediaType: 'video/webm', bytes: webm });
    expect(
      await Effect.runPromise(
        store.readProofFile({ worktreeId, proofId: link?.id ?? '' }),
      ),
    ).toBeUndefined();
  });

  it('drops the previous proof files when a later publish attaches none', async () => {
    const { service, store } = setup();
    const first = Effect.runSync(
      service.execute({
        worktreeId,
        draft: draft({
          proof: {
            assets: [{ kind: 'image', title: 'Shot', path: 'shot.png' }],
          },
        }),
        evidence: evidence(),
        proofFiles: reads([['shot.png', png]]),
      }),
    );
    const second = Effect.runSync(
      service.execute({
        worktreeId,
        draft: draft({ expectedRevision: 1 }),
        evidence: evidence(),
      }),
    );
    expect(second.review.proof).toBeUndefined();
    expect(
      await Effect.runPromise(
        store.readProofFile({
          worktreeId,
          proofId: first.review.proof?.assets[0]?.id ?? '',
        }),
      ),
    ).toBeUndefined();
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
    async ({ kind, proofFiles, error }) => {
      const { service, store } = setup();
      Effect.runSync(
        service.execute({ worktreeId, draft: draft(), evidence: evidence() }),
      );
      expect(() =>
        Effect.runSync(
          service.execute({
            worktreeId,
            draft: draft({
              expectedRevision: 1,
              proof: { assets: [{ kind, title: 'Proof', path: 'proof' }] },
            }),
            evidence: evidence(),
            proofFiles,
          }),
        ),
      ).toThrow(error);
      expect(
        (await Effect.runPromise(store.read({ worktreeId })))?.revision,
      ).toBe(1);
    },
  );

  it('refuses files that fit one by one but not together', async () => {
    const { service, store } = setup(png.byteLength * 2 - 1);
    expect(() =>
      Effect.runSync(
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
      ),
    ).toThrow(ProofTooLargeError);
    expect(await Effect.runPromise(store.read({ worktreeId }))).toBeUndefined();
  });

  it('keeps a published file when the next publish names it by its proof id', async () => {
    const { service, store } = setup();
    const first = Effect.runSync(
      service.execute({
        worktreeId,
        draft: draft({
          proof: {
            assets: [{ kind: 'image', title: 'Shot', path: 'shot.png' }],
          },
        }),
        evidence: evidence(),
        proofFiles: reads([['shot.png', png]]),
      }),
    );
    const kept = first.review.proof?.assets[0]?.id ?? '';
    const second = Effect.runSync(
      service.execute({
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
      }),
    );
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
      await Effect.runPromise(
        store.readProofFile({ worktreeId, proofId: asset?.id ?? '' }),
      ),
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
  ])('refuses $name and keeps the stored review', async ({ kind, known }) => {
    const { service, store } = setup();
    const first = Effect.runSync(
      service.execute({
        worktreeId,
        draft: draft({
          proof: {
            assets: [{ kind: 'image', title: 'Shot', path: 'shot.png' }],
          },
        }),
        evidence: evidence(),
        proofFiles: reads([['shot.png', png]]),
      }),
    );
    const proofId = known
      ? (first.review.proof?.assets[0]?.id ?? '')
      : 'no-such-proof';
    expect(() =>
      Effect.runSync(
        service.execute({
          worktreeId,
          draft: draft({
            expectedRevision: 1,
            proof: { assets: [{ kind, title: 'Shot', proofId }] },
          }),
          evidence: evidence(),
        }),
      ),
    ).toThrow(known ? UnsupportedProofFileError : UnknownProofFileError);
    expect(
      (await Effect.runPromise(store.read({ worktreeId })))?.revision,
    ).toBe(1);
  });
});
