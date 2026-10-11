import { describe, expect, it } from 'vitest';
import type {
  Diagram,
  LayerDraft,
  ReviewDraft,
  StepDraft,
} from '@porcelain/reviews/models';
import { reviewDraftProblem } from './review-draft.ts';

function step(id: string, lane = 0): StepDraft {
  return {
    id,
    lane,
    title: 'Step',
    text: 'Explains a line',
    kind: 'changed',
    pointer: { path: 'README.md', startLine: 1, endLine: 1 },
  };
}

function layer(id: string, overrides: Partial<LayerDraft> = {}): LayerDraft {
  return {
    id,
    title: 'Layer',
    summary: 'A layer',
    lanes: ['Docs', 'Code'],
    steps: [step('step-a'), step('step-b', 1)],
    ...overrides,
  };
}

function diagram(overrides: Partial<Diagram> = {}): Diagram {
  return {
    boxes: [
      { id: 'box-a', label: 'Browser' },
      { id: 'box-b', label: 'API' },
    ],
    arrows: [{ from: 'box-a', to: 'box-b' }],
    ...overrides,
  };
}

function draft(overrides: Partial<ReviewDraft> = {}): ReviewDraft {
  return {
    expectedRevision: 0,
    summaryHtml: '<p>Summary</p>',
    diagram: { after: diagram() },
    layers: [layer('layer-a'), layer('layer-b')],
    ...overrides,
  };
}

describe('reviewDraftProblem', () => {
  it('accepts a review whose ids, lanes and arrows all agree, and refuses it once a pointer runs backwards', () => {
    expect(reviewDraftProblem(draft())).toBeUndefined();
    const reversed = layer('layer-a', {
      steps: [
        {
          ...step('step-a'),
          pointer: { path: 'README.md', startLine: 2, endLine: 1 },
        },
        step('step-b', 1),
      ],
    });
    expect(reviewDraftProblem(draft({ layers: [reversed] }))).toEqual({
      kind: 'reversed-pointer',
    });
  });

  it('accepts a review without a diagram', () => {
    const plain = draft({
      diagram: undefined,
      layers: [layer('layer-a')],
    });
    expect(reviewDraftProblem(plain)).toBeUndefined();
  });

  it('refuses a step id used twice in one layer', () => {
    const repeated = layer('layer-a', {
      steps: [step('step-a'), step('step-a', 1)],
    });
    expect(reviewDraftProblem(draft({ layers: [repeated] }))).toEqual({
      kind: 'duplicate-step-id',
    });
  });

  it('allows the same step id in two different layers', () => {
    expect(
      reviewDraftProblem(
        draft({ layers: [layer('layer-a'), layer('layer-b')] }),
      ),
    ).toBeUndefined();
  });

  it('accepts a step on the last lane and refuses one past it', () => {
    const last = layer('layer-a', { steps: [step('step-a', 1)] });
    const past = layer('layer-a', { steps: [step('step-a', 2)] });
    expect(reviewDraftProblem(draft({ layers: [last] }))).toBeUndefined();
    expect(reviewDraftProblem(draft({ layers: [past] }))).toEqual({
      kind: 'step-lane-out-of-range',
    });
  });

  it('accepts an owner and its decision with the same published layer, but refuses an unknown box layer', () => {
    const boxes = [
      {
        id: 'decision',
        label: 'Introduce delivery',
        layerId: 'layer-a',
        decision: true as const,
      },
      { id: 'outbox', label: 'Delivery outbox', layerId: 'layer-a' },
    ];
    expect(
      reviewDraftProblem(
        draft({ diagram: { after: diagram({ boxes, arrows: [] }) } }),
      ),
    ).toBeUndefined();
    expect(
      reviewDraftProblem(
        draft({
          diagram: {
            after: diagram({
              boxes: [{ ...boxes[1]!, layerId: 'unknown' }],
              arrows: [],
            }),
          },
        }),
      ),
    ).toEqual({ kind: 'unknown-box-layer' });
  });

  it('refuses a decision marker without its layer or a second decision box for the same layer', () => {
    const decision = {
      id: 'decision',
      label: 'Introduce delivery',
      decision: true as const,
    };
    expect(
      reviewDraftProblem(
        draft({
          diagram: { after: diagram({ boxes: [decision], arrows: [] }) },
        }),
      ),
    ).toEqual({ kind: 'invalid-decision-box' });
    expect(
      reviewDraftProblem(
        draft({
          diagram: {
            after: diagram({
              boxes: [
                { ...decision, layerId: 'layer-a' },
                { ...decision, id: 'other', layerId: 'layer-a' },
              ],
              arrows: [],
            }),
          },
        }),
      ),
    ).toEqual({ kind: 'invalid-decision-box' });
  });

  it.each([
    { name: 'to', arrow: { from: 'box-a', to: 'box-z' } },
    { name: 'from', arrow: { from: 'box-z', to: 'box-b' } },
  ])(
    'refuses a diagram arrow $name a box the diagram does not have',
    ({ arrow }) => {
      expect(
        reviewDraftProblem(
          draft({ diagram: { after: diagram({ arrows: [arrow] }) } }),
        ),
      ).toEqual({ kind: 'unknown-arrow-box' });
    },
  );

  it('refuses a layer id used twice in the review', () => {
    expect(
      reviewDraftProblem(
        draft({ layers: [layer('layer-a'), layer('layer-a')] }),
      ),
    ).toEqual({ kind: 'duplicate-layer-id' });
  });
});
