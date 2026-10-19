import { reviewFixture } from '../../spec/fixtures/review.ts';
import { testClock } from '@porcelain/kernel/test-kit';
import {
  SequentialIdSource,
  SequentialSecretSource,
} from '@porcelain/kernel/fakes';
import { IdSource, SecretSource } from '@porcelain/kernel/ports';
import {
  ReviewStore,
  ProofLimits,
  ReviewCommitPinner,
} from '@porcelain/reviews/ports';
import { ValidateReviewDraftService } from '@porcelain/reviews/services';
import { Effect, Clock } from 'effect';
import { describe, expect, it } from 'vitest';
import {
  ProofFileUnreadableError,
  ProofTooLargeError,
  ReviewConflictError,
  InvalidReviewPointerError,
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
import { InMemoryReviewStore } from '../../spec/fakes/in-memory-review-store.ts';
import { PublishReviewService } from './publish-review-service.ts';

const publishedReviewId = '00000000-0000-4000-8000-000000000001';
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

function evidence(
  texts: [string, string][] = [['README.md', readme]],
  missing: string[] = [],
): ReviewEvidence {
  return {
    changes: [],
    missing: new Set(missing),
    texts: new Map(texts),
    diffs: [],
  };
}

const stillChanged: ReviewEvidence = {
  changes: [modified],
  missing: new Set<string>(),
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
      verdict: reviewFixture().verdict,
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

async function setup(totalBytes = 1024) {
  const store = new InMemoryReviewStore();
  const service = Effect.runSync(
    PublishReviewService.pipe(
      Effect.provide(PublishReviewService.layer),
      Effect.provideService(ReviewStore, store),
      Effect.provideService(ReviewCommitPinner, { pin: () => Effect.void }),
      Effect.provideService(
        Clock.Clock,
        await testClock('2026-01-01T00:00:00.000Z'),
      ),
      Effect.provideService(IdSource, new SequentialIdSource()),
      Effect.provideService(SecretSource, new SequentialSecretSource()),
      Effect.provideService(ProofLimits, { totalBytes, signatureBytes: 16 }),
    ),
  );
  return {
    store,
    service: {
      execute: (
        input: Omit<Parameters<typeof service.execute>[0], 'commit'> & {
          commit?: Parameters<typeof service.execute>[0]['commit'];
        },
      ) => service.execute({ commit: reviewFixture(), ...input }),
    },
  };
}

describe('PublishReviewService', () => {
  it('publishes the first review at revision one with the lines each step points at', async () => {
    const { service, store } = await setup();
    const { review, warnings } = Effect.runSync(
      service.execute({
        worktreeId,
        commit: reviewFixture(),
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
    expect(
      await Effect.runPromise(store.read({ reviewId: publishedReviewId })),
    ).toEqual(review);
  });

  it('stores a committed revision active even when no worktree diff remains', async () => {
    const { service, store } = await setup();
    const { review } = Effect.runSync(
      service.execute({
        worktreeId,
        commit: reviewFixture(),
        draft: draft(),
        evidence: evidence([['README.md', readme]]),
      }),
    );
    expect(review.active).toBe(true);
    expect(
      (await Effect.runPromise(store.read({ reviewId: publishedReviewId })))
        ?.active,
    ).toBe(true);
  });

  it.each([
    {
      name: 'a missing file',
      texts: [] as [string, string][],
      missing: ['README.md'],
      reason: 'missing',
      message: 'which does not exist in this worktree',
    },
    {
      name: 'an unreadable file',
      texts: [] as [string, string][],
      missing: [],
      reason: 'unreadable',
      message: 'which is not a readable text file',
    },
    {
      name: 'a range past the end',
      texts: [['README.md', 'first\n']] as [string, string][],
      missing: [],
      reason: 'out-of-range',
      message: 'but the file has 1 lines',
    },
  ])(
    'refuses $name before saving and names the pointer',
    async ({ texts, missing, reason, message }) => {
      const { service, store } = await setup();
      const result = Effect.runSync(
        Effect.result(
          service.execute({
            worktreeId,
            draft: draft(),
            evidence: evidence(texts, missing),
          }),
        ),
      );
      expect(result).toMatchObject({
        _tag: 'Failure',
        failure: {
          reason,
          layerId: 'layer-1',
          stepId: 'step-1',
          path: 'README.md',
          startLine: 2,
          endLine: 3,
        },
      });
      if (result._tag === 'Failure') {
        expect(result.failure).toBeInstanceOf(InvalidReviewPointerError);
        expect(result.failure.message).toBe(
          `Step \`step-1\` in layer \`layer-1\` points to \`README.md:2-3\`, ${message}`,
        );
      }
      expect(
        await Effect.runPromise(store.read({ reviewId: publishedReviewId })),
      ).toBeUndefined();
    },
  );

  it('replaces the review when the publisher states the current revision, with a fresh summary link', async () => {
    const { service } = await setup();
    const first = Effect.runSync(
      service.execute({
        worktreeId,
        commit: reviewFixture(),
        draft: draft(),
        evidence: evidence(),
      }),
    );
    const second = Effect.runSync(
      service.execute({
        worktreeId,
        commit: reviewFixture(),
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
      const { service, store } = await setup();
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
        (await Effect.runPromise(store.read({ reviewId: publishedReviewId })))
          ?.summaryHtml,
      ).toBe(styled);
    },
  );

  it('warns when the summary carries no authored CSS but still publishes', async () => {
    const { service, store } = await setup();
    const { warnings } = Effect.runSync(
      service.execute({
        worktreeId,
        commit: reviewFixture(),
        draft: draft({ summaryHtml: '<h1>Summary</h1>' }),
        evidence: evidence(),
      }),
    );
    expect(warnings).toEqual(['missing-style']);
    expect(
      (await Effect.runPromise(store.read({ reviewId: publishedReviewId })))
        ?.revision,
    ).toBe(1);
  });

  it('publishes checks as given and keeps each attached file under its own id with the type its bytes show', async () => {
    const { service, store } = await setup();
    const { review } = Effect.runSync(
      service.execute({
        worktreeId,
        commit: reviewFixture(),
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
      paths: ['shot.png', 'run.webm'],
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
    });
    expect(new Set([image?.id, video?.id, link?.id]).size).toBe(3);
    expect(
      (await Effect.runPromise(store.read({ reviewId: publishedReviewId })))
        ?.proof,
    ).toEqual(review.proof);
    expect(
      await Effect.runPromise(
        store.readProofFile({
          reviewId: publishedReviewId,
          proofId: image?.id ?? '',
        }),
      ),
    ).toEqual({ id: image?.id, mediaType: 'image/png', bytes: png });
    expect(
      await Effect.runPromise(
        store.readProofFile({
          reviewId: publishedReviewId,
          proofId: video?.id ?? '',
        }),
      ),
    ).toEqual({ id: video?.id, mediaType: 'video/webm', bytes: webm });
    expect(
      await Effect.runPromise(
        store.readProofFile({
          reviewId: publishedReviewId,
          proofId: link?.id ?? '',
        }),
      ),
    ).toBeUndefined();
  });

  it('publishes without summary HTML using an empty document readable by existing clients', async () => {
    const { service } = await setup();
    const { summaryHtml: _, ...input } = draft();
    const published = Effect.runSync(
      service.execute({
        worktreeId,
        commit: reviewFixture(),
        draft: input,
        evidence: evidence(),
      }),
    );
    expect(published.review.summaryHtml).toBe(
      '<!doctype html><html><body></body></html>',
    );
    expect(published.warnings).toEqual([]);
  });

  it('retains prior revision proof files when a later publish attaches none', async () => {
    const { service, store } = await setup();
    Effect.runSync(
      service.execute({
        worktreeId,
        commit: reviewFixture(),
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
        commit: reviewFixture(),
        draft: draft({ expectedRevision: 1 }),
        evidence: evidence(),
      }),
    );
    expect(second.review.proof).toBeUndefined();
    expect(
      await Effect.runPromise(
        store.readProofFile({
          reviewId: publishedReviewId,
          proofId: '00000000-0000-4000-8000-000000000002',
        }),
      ),
    ).toEqual({
      id: '00000000-0000-4000-8000-000000000002',
      mediaType: 'image/png',
      bytes: png,
    });
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
      const { service, store } = await setup();
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
        (await Effect.runPromise(store.read({ reviewId: publishedReviewId })))
          ?.revision,
      ).toBe(1);
    },
  );

  it('refuses files that fit one by one but not together', async () => {
    const { service, store } = await setup(png.byteLength * 2 - 1);
    expect(() =>
      Effect.runSync(
        service.execute({
          worktreeId,
          commit: reviewFixture(),
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
    expect(
      await Effect.runPromise(store.read({ reviewId: publishedReviewId })),
    ).toBeUndefined();
  });

  it('keeps a published file when the next publish names it by its proof id', async () => {
    const { service, store } = await setup();
    const first = Effect.runSync(
      service.execute({
        worktreeId,
        commit: reviewFixture(),
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
        commit: reviewFixture(),
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
        store.readProofFile({
          reviewId: publishedReviewId,
          proofId: asset?.id ?? '',
        }),
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
    const { service, store } = await setup();
    const first = Effect.runSync(
      service.execute({
        worktreeId,
        commit: reviewFixture(),
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
          commit: reviewFixture(),
          draft: draft({
            expectedRevision: 1,
            proof: { assets: [{ kind, title: 'Shot', proofId }] },
          }),
          evidence: evidence(),
        }),
      ),
    ).toThrow(known ? UnsupportedProofFileError : UnknownProofFileError);
    expect(
      (await Effect.runPromise(store.read({ reviewId: publishedReviewId })))
        ?.revision,
    ).toBe(1);
  });
});
