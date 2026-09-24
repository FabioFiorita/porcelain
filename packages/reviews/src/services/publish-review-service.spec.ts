import { describe, expect, it } from 'vitest';
import { FixedClock, SequentialIdSource } from '@porcelain/kernel/fakes';
import {
  BoxLaneOutOfRangeError,
  DuplicateLayerIdError,
  DuplicateStepIdError,
  InvalidLineRangeError,
  ReviewConflictError,
  StepLaneOutOfRangeError,
  UnknownArrowBoxError,
  UnknownArrowStepError,
} from '@porcelain/reviews/errors';
import type {
  DiagramBox,
  LayerDraft,
  ReviewDraft,
  ReviewTextRead,
} from '@porcelain/reviews/models';
import { FixedSecretSource } from '../../spec/fakes/fixed-secret-source.ts';
import { InMemoryReviewStore } from '../../spec/fakes/in-memory-review-store.ts';
import { PublishReviewService } from './publish-review-service.ts';

const worktreeId = 'a'.repeat(64);
const styled = '<style>h1{color:red}</style><h1>Summary</h1>';
const readme: ReviewTextRead = {
  status: 'fulfilled',
  value: { path: 'README.md', text: 'first\nsecond\nadded\n' },
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

function setup() {
  const store = new InMemoryReviewStore();
  const service = new PublishReviewService(
    store,
    new FixedClock('2026-01-01T00:00:00.000Z'),
    new SequentialIdSource(),
    new FixedSecretSource(),
  );
  return { store, service };
}

describe('PublishReviewService', () => {
  it('publishes the first review at revision one with the lines each step points at', () => {
    const { service, store } = setup();
    const { review, warnings } = service.execute({
      worktreeId,
      draft: draft(),
      texts: [readme],
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
    const unreadable: ReviewTextRead = {
      status: 'rejected',
      reason: new Error('missing'),
    };
    const { review } = service.execute({
      worktreeId,
      draft: draft({ layers: [layer(), past] }),
      texts: [unreadable],
    });
    expect(review.layers.map((entry) => entry.steps[0]?.published)).toEqual([
      [],
      [],
    ]);
    expect(
      setup().service.execute({
        worktreeId,
        draft: draft({ layers: [past] }),
        texts: [readme],
      }).review.layers[0]?.steps[0]?.published,
    ).toEqual([]);
  });

  it('replaces the review when the publisher states the current revision, with a fresh summary link', () => {
    const { service } = setup();
    const first = service.execute({ worktreeId, draft: draft(), texts: [] });
    const second = service.execute({
      worktreeId,
      draft: draft({ expectedRevision: 1 }),
      texts: [],
    });
    expect(second.review.revision).toBe(2);
    expect(second.review.summaryToken).not.toBe(first.review.summaryToken);
  });

  it('refuses a publish that does not state the current revision and keeps the stored review', () => {
    const { service, store } = setup();
    service.execute({ worktreeId, draft: draft(), texts: [] });
    for (const expectedRevision of [0, 2])
      expect(() =>
        service.execute({
          worktreeId,
          draft: draft({ expectedRevision, summaryHtml: '<p>Other</p>' }),
          texts: [],
        }),
      ).toThrow(ReviewConflictError);
    expect(store.read({ worktreeId })?.summaryHtml).toBe(styled);
  });

  it('refuses a draft whose ids, lanes or arrows disagree with the error naming the problem', () => {
    const box: DiagramBox = {
      id: 'box-1',
      lane: 0,
      label: 'API',
      kind: 'component',
    };
    const invalid: [ReviewDraft, new () => Error][] = [
      [draft({ layers: [layer(), layer()] }), DuplicateLayerIdError],
      [
        draft({
          layers: [layer({ steps: [...layer().steps, ...layer().steps] })],
        }),
        DuplicateStepIdError,
      ],
      [
        draft({
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
        InvalidLineRangeError,
      ],
      [draft({ layers: [layer({ lanes: [] })] }), StepLaneOutOfRangeError],
      [
        draft({
          layers: [layer({ arrows: [{ from: 'step-1', to: 'step-9' }] })],
        }),
        UnknownArrowStepError,
      ],
      [
        draft({
          diagram: {
            after: { lanes: [], boxes: [box], arrows: [] },
          },
        }),
        BoxLaneOutOfRangeError,
      ],
      [
        draft({
          diagram: {
            after: {
              lanes: ['Server'],
              boxes: [box],
              arrows: [{ from: 'box-1', to: 'box-9' }],
            },
          },
        }),
        UnknownArrowBoxError,
      ],
    ];
    const { service, store } = setup();
    for (const [refused, error] of invalid)
      expect(() =>
        service.execute({ worktreeId, draft: refused, texts: [] }),
      ).toThrow(error);
    expect(store.read({ worktreeId })).toBeUndefined();
  });

  it('warns when the summary carries no authored CSS but still publishes', () => {
    const { service, store } = setup();
    const { warnings } = service.execute({
      worktreeId,
      draft: draft({ summaryHtml: '<h1>Summary</h1>' }),
      texts: [],
    });
    expect(warnings).toHaveLength(1);
    expect(store.read({ worktreeId })?.revision).toBe(1);
  });
});
