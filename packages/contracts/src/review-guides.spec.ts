import { describe, expect, it } from 'vitest';
import {
  replaceReviewLayersSchema,
  reviewLayersResponseSchema,
} from './review-layers.ts';

const source = {
  path: 'src/navigation.ts',
  startLine: 2,
  endLine: 4,
  contentFingerprint: 'a'.repeat(64),
};
const step = {
  id: '00000000-0000-4000-8000-000000000001',
  title: 'Advance',
  question: 'Who owns the next transition?',
  source,
};
const layer = {
  id: '00000000-0000-4000-8000-000000000002',
  title: 'Navigation',
  files: [{ path: 'src/navigation.ts', scope: 'unstaged' as const }],
};
const guide = { purpose: 'Understand native back navigation.', steps: [step] };
const request = (value: unknown) => ({
  expectedRevision: 0,
  layers: [{ ...layer, guide: value }],
});

describe('guided review metadata', () => {
  it('keeps existing unguided layers compatible', () => {
    const input = { expectedRevision: 0, layers: [layer] };
    expect(replaceReviewLayersSchema.parse(input)).toEqual(input);
  });

  it('preserves guide metadata in requests and responses', () => {
    const parsed = replaceReviewLayersSchema.parse(request(guide));
    const response = reviewLayersResponseSchema.parse({
      worktreeId: '00000000-0000-4000-8000-000000000003',
      revision: 1,
      layers: parsed.layers,
    });
    expect(response.layers[0]?.guide).toEqual(guide);
  });

  it('allows unchanged and cross-layer context without duplicate assignment', () => {
    const input = request({
      ...guide,
      steps: [
        { ...step, related: [{ title: 'State owner', source }] },
        { ...step, id: '00000000-0000-4000-8000-000000000004' },
      ],
    });
    const parsed = replaceReviewLayersSchema.parse(input);
    expect(parsed.layers[0]?.files).toEqual(layer.files);
    expect(parsed.layers[0]?.guide?.steps).toHaveLength(2);
  });

  it.each([
    { path: '../secret' },
    { path: '/absolute' },
    { path: '.GIT/config' },
    { path: 'src\\secret' },
    { path: 'C:secret' },
    { startLine: 0 },
    { startLine: 1.5 },
    { startLine: 5, endLine: 4 },
    { endLine: 1_000_001 },
    { contentFingerprint: 'unbound' },
    { contentFingerprint: undefined },
    { revision: 'main' },
  ])('rejects invalid or ambiguous source references: %j', (invalid) => {
    const input = request({
      ...guide,
      steps: [{ ...step, source: { ...source, ...invalid } }],
    });
    expect(replaceReviewLayersSchema.safeParse(input).success).toBe(false);
  });

  it('rejects empty guides and duplicate stable step IDs', () => {
    for (const steps of [[], [step, step]]) {
      expect(
        replaceReviewLayersSchema.safeParse(request({ ...guide, steps }))
          .success,
      ).toBe(false);
    }
  });

  it('bounds step counts, related sources and explanation length', () => {
    const tooManySteps = Array.from({ length: 25 }, (_, index) => ({
      ...step,
      id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    }));
    const tooManyRelated = Array.from({ length: 5 }, () => ({
      title: 'Context',
      source,
    }));
    for (const value of [
      { ...guide, steps: tooManySteps },
      { ...guide, steps: [{ ...step, related: tooManyRelated }] },
      { ...guide, purpose: 'x'.repeat(1201) },
    ]) {
      expect(replaceReviewLayersSchema.safeParse(request(value)).success).toBe(
        false,
      );
    }
  });

  it('does not weaken changed-file assignment uniqueness', () => {
    expect(
      replaceReviewLayersSchema.safeParse({
        expectedRevision: 0,
        layers: [
          { ...layer, guide },
          { ...layer, id: '00000000-0000-4000-8000-000000000005' },
        ],
      }).success,
    ).toBe(false);
  });
});
