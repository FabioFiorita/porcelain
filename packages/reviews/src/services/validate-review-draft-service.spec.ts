import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { InvalidLineRangeError } from '@porcelain/kernel/errors';
import {
  BoxLaneOutOfRangeError,
  DuplicateLayerIdError,
  DuplicateStepIdError,
  StepLaneOutOfRangeError,
  UnknownArrowBoxError,
  UnknownArrowStepError,
  UnknownProofTargetError,
} from '@porcelain/reviews/errors';
import {
  type DiagramBox,
  type LayerDraft,
  type ReviewDraft,
} from '@porcelain/reviews/models';
import { ValidateReviewDraftService } from './validate-review-draft-service.ts';

const styled = '<style>h1{color:red}</style><h1>Summary</h1>';

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

describe('review draft validation', () => {
  it('validates a detached copy so later changes to the input cannot invalidate it', () => {
    const originalLayer = layer();
    const input = draft({ layers: [originalLayer] });
    const validated = Effect.runSync(
      Effect.runSync(
        ValidateReviewDraftService.pipe(
          Effect.provide(ValidateReviewDraftService.layer),
        ),
      ).execute(input),
    );
    input.summaryHtml = '<p>Changed</p>';
    originalLayer.title = 'Changed';
    expect(validated.summaryHtml).toBe(styled);
    expect(validated.layers[0]?.title).toBe('Readme');
  });
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
  ])('refuses a draft with $name', ({ refused, error }) => {
    expect(() =>
      Effect.runSync(
        Effect.runSync(
          ValidateReviewDraftService.pipe(
            Effect.provide(ValidateReviewDraftService.layer),
          ),
        ).execute(refused),
      ),
    ).toThrow(error);
  });
});
