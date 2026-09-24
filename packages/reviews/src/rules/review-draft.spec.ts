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

describe('reviewDraftProblem', () => {
  it('accepts a review whose ids, lanes and arrows all agree', () => {
    expect(reviewDraftProblem(draft())).toBeUndefined();
  });

  it('accepts a review without a diagram or layer arrows', () => {
    const plain = draft({
      diagram: undefined,
      layers: [layer('layer-a', { arrows: undefined })],
    });
    expect(reviewDraftProblem(plain)).toBeUndefined();
  });

  it('refuses a step id used twice in one layer', () => {
    const repeated = layer('layer-a', {
      steps: [step('step-a'), step('step-a', 1)],
      arrows: [],
    });
    expect(reviewDraftProblem(draft({ layers: [repeated] }))).toBe(
      'duplicate-step-id',
    );
  });

  it('allows the same step id in two different layers', () => {
    expect(
      reviewDraftProblem(
        draft({ layers: [layer('layer-a'), layer('layer-b')] }),
      ),
    ).toBeUndefined();
  });

  it('accepts a step on the last lane and refuses one past it', () => {
    const last = layer('layer-a', { steps: [step('step-a', 1)], arrows: [] });
    const past = layer('layer-a', { steps: [step('step-a', 2)], arrows: [] });
    expect(reviewDraftProblem(draft({ layers: [last] }))).toBeUndefined();
    expect(reviewDraftProblem(draft({ layers: [past] }))).toBe(
      'step-lane-out-of-range',
    );
  });

  it.each([
    { name: 'to', arrow: { from: 'step-a', to: 'elsewhere' } },
    { name: 'from', arrow: { from: 'elsewhere', to: 'step-b' } },
  ])(
    'refuses a layer arrow $name a step the layer does not have',
    ({ arrow }) => {
      expect(
        reviewDraftProblem(
          draft({ layers: [layer('layer-a', { arrows: [arrow] })] }),
        ),
      ).toBe('unknown-arrow-step');
    },
  );

  it('refuses a layer arrow that names a step of another layer', () => {
    const other = layer('layer-b', {
      steps: [step('step-c')],
      arrows: [{ from: 'step-c', to: 'step-a' }],
    });
    expect(
      reviewDraftProblem(draft({ layers: [layer('layer-a'), other] })),
    ).toBe('unknown-arrow-step');
  });

  it('refuses a diagram box past its lanes, in the after or the before diagram', () => {
    const outside = diagram({
      boxes: [{ id: 'box-a', lane: 2, label: 'Lost', kind: 'storage' }],
      arrows: [],
    });
    expect(reviewDraftProblem(draft({ diagram: { after: outside } }))).toBe(
      'box-lane-out-of-range',
    );
    expect(
      reviewDraftProblem(
        draft({ diagram: { after: diagram(), before: outside } }),
      ),
    ).toBe('box-lane-out-of-range');
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
      ).toBe('unknown-arrow-box');
    },
  );

  it('refuses a layer id used twice in the review', () => {
    expect(
      reviewDraftProblem(
        draft({ layers: [layer('layer-a'), layer('layer-a')] }),
      ),
    ).toBe('duplicate-layer-id');
  });
});
