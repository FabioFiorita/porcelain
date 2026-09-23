import { describe, expect, it } from 'vitest';
import {
  BoxLaneOutOfRangeError,
  DuplicateLayerIdError,
  DuplicateStepIdError,
  StepLaneOutOfRangeError,
  UnknownArrowBoxError,
  UnknownArrowStepError,
} from '@porcelain/reviews/errors';
import type {
  Diagram,
  LayerDraft,
  ReviewDraft,
  StepDraft,
} from '@porcelain/reviews/models';
import { assertReviewDraft } from './review-draft.ts';

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
    arrows: [{ from: 'step-a', to: 'step-b' }],
    ...overrides,
  };
}

function diagram(overrides: Partial<Diagram> = {}): Diagram {
  return {
    lanes: ['Client', 'Server'],
    boxes: [
      { id: 'box-a', lane: 0, label: 'Browser', kind: 'actor' },
      { id: 'box-b', lane: 1, label: 'API', kind: 'component' },
    ],
    arrows: [{ from: 'box-a', to: 'box-b' }],
    ...overrides,
  };
}

function draft(overrides: Partial<ReviewDraft> = {}): ReviewDraft {
  return {
    expectedRevision: 0,
    summaryHtml: '<p>Summary</p>',
    diagram: { after: diagram(), before: diagram() },
    layers: [layer('layer-a'), layer('layer-b')],
    ...overrides,
  };
}

describe('assertReviewDraft', () => {
  it('accepts a review whose ids, lanes and arrows all agree', () => {
    expect(() => assertReviewDraft(draft())).not.toThrow();
  });

  it('accepts a review without a diagram or layer arrows', () => {
    const plain = draft({
      diagram: undefined,
      layers: [layer('layer-a', { arrows: undefined })],
    });
    expect(() => assertReviewDraft(plain)).not.toThrow();
  });

  it('refuses a step id used twice in one layer', () => {
    const repeated = layer('layer-a', {
      steps: [step('step-a'), step('step-a', 1)],
      arrows: [],
    });
    expect(() => assertReviewDraft(draft({ layers: [repeated] }))).toThrow(
      DuplicateStepIdError,
    );
  });

  it('allows the same step id in two different layers', () => {
    expect(() =>
      assertReviewDraft(
        draft({ layers: [layer('layer-a'), layer('layer-b')] }),
      ),
    ).not.toThrow();
  });

  it('accepts a step on the last lane and refuses one past it', () => {
    const last = layer('layer-a', { steps: [step('step-a', 1)], arrows: [] });
    const past = layer('layer-a', { steps: [step('step-a', 2)], arrows: [] });
    expect(() => assertReviewDraft(draft({ layers: [last] }))).not.toThrow();
    expect(() => assertReviewDraft(draft({ layers: [past] }))).toThrow(
      StepLaneOutOfRangeError,
    );
  });

  it('refuses a layer arrow from or to a step the layer does not have', () => {
    for (const arrow of [
      { from: 'step-a', to: 'elsewhere' },
      { from: 'elsewhere', to: 'step-b' },
    ])
      expect(() =>
        assertReviewDraft(
          draft({ layers: [layer('layer-a', { arrows: [arrow] })] }),
        ),
      ).toThrow(UnknownArrowStepError);
  });

  it('refuses a layer arrow that names a step of another layer', () => {
    const other = layer('layer-b', {
      steps: [step('step-c')],
      arrows: [{ from: 'step-c', to: 'step-a' }],
    });
    expect(() =>
      assertReviewDraft(draft({ layers: [layer('layer-a'), other] })),
    ).toThrow(UnknownArrowStepError);
  });

  it('refuses a diagram box past its lanes, in the after or the before diagram', () => {
    const outside = diagram({
      boxes: [{ id: 'box-a', lane: 2, label: 'Lost', kind: 'storage' }],
      arrows: [],
    });
    expect(() =>
      assertReviewDraft(draft({ diagram: { after: outside } })),
    ).toThrow(BoxLaneOutOfRangeError);
    expect(() =>
      assertReviewDraft(
        draft({ diagram: { after: diagram(), before: outside } }),
      ),
    ).toThrow(BoxLaneOutOfRangeError);
  });

  it('refuses a diagram arrow from or to a box the diagram does not have', () => {
    for (const arrow of [
      { from: 'box-a', to: 'box-z' },
      { from: 'box-z', to: 'box-b' },
    ])
      expect(() =>
        assertReviewDraft(
          draft({ diagram: { after: diagram({ arrows: [arrow] }) } }),
        ),
      ).toThrow(UnknownArrowBoxError);
  });

  it('refuses a layer id used twice in the review', () => {
    expect(() =>
      assertReviewDraft(
        draft({ layers: [layer('layer-a'), layer('layer-a')] }),
      ),
    ).toThrow(DuplicateLayerIdError);
  });
});
