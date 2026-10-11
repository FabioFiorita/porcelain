import { describe, expect, it } from 'vitest';
import type { ReviewLayer, ReviewStep } from '../models/review.ts';
import {
  currentLayerFingerprint,
  resolveReview,
  reviewIsActive,
  unexplainedChanges,
} from './resolve-review.ts';

const step: ReviewStep = {
  id: 's3',
  lane: 0,
  title: 'Explain code',
  text: 'Adds behaviour',
  kind: 'changed',
  pointer: { path: 'src/x.ts', startLine: 1, endLine: 1 },
  published: ['return 1;'],
};
const layer: ReviewLayer = {
  id: 'l1',
  title: 'Behaviour',
  summary: 'Explains behaviour',
  lanes: ['Code'],
  steps: [step],
  fingerprint: 'published',
};
function resolve(
  steps: ReviewStep[],
  texts: [string, string][] = [],
  missing = ['src/x.ts'],
) {
  const present = new Set(texts.map(([path]) => path));
  return resolveReview(
    { layers: [{ ...layer, steps }] },
    {
      texts: new Map(texts),
      missing: new Set(missing.filter((path) => !present.has(path))),
      changes: [],
      diffs: [],
    },
  );
}

describe('broken review pointers', () => {
  it('resolves a disappeared file as broken and changes the layer fingerprint', () => {
    const resolved = resolve([step]);
    expect(resolved.layers[0]?.steps[0]?.location).toEqual({ state: 'broken' });
    expect(currentLayerFingerprint(layer, new Map())).not.toBe(
      currentLayerFingerprint(layer, new Map([['src/x.ts', 'return 1;\n']])),
    );
  });

  it('makes a review inactive when its only remaining changed-kind steps are broken', () => {
    expect(
      reviewIsActive(resolve([step], [['src/x.ts', 'return 2;\n']]).layers),
    ).toBe(true);
    expect(reviewIsActive(resolve([step]).layers)).toBe(false);
    expect(
      reviewIsActive(
        resolve(
          [
            step,
            {
              ...step,
              id: 'committed',
              pointer: { path: 'kept.ts', startLine: 1, endLine: 1 },
            },
          ],
          [['kept.ts', 'return 1;\n']],
        ).layers,
      ),
    ).toBe(false);
  });

  it('keeps an unreadable or transiently failed read changed and active', () => {
    const resolved = resolve([step], [], []);
    expect(resolved.layers[0]?.steps[0]?.location).toEqual({
      state: 'changed',
    });
    expect(reviewIsActive(resolved.layers)).toBe(true);
  });

  it('keeps a review active when a broken step accompanies current uncommitted work', () => {
    const kept = {
      ...step,
      id: 'current',
      pointer: { path: 'kept.ts', startLine: 1, endLine: 1 },
    };
    const resolved = resolveReview(
      { layers: [{ ...layer, steps: [step, kept] }] },
      {
        texts: new Map([['kept.ts', 'return 1;\n']]),
        missing: new Set(['src/x.ts']),
        changes: [
          {
            path: 'kept.ts',
            fingerprint: 'new',
            comparisons: [{ scope: 'untracked', path: 'kept.ts' }],
          },
        ],
        diffs: [],
      },
    );
    expect(
      resolved.layers[0]?.steps.map((entry) => entry.location.state),
    ).toEqual(['broken', 'current']);
    expect(reviewIsActive(resolved.layers)).toBe(true);
  });

  it('resolves a legacy empty published block as broken even when the file exists', () => {
    const resolved = resolve(
      [{ ...step, published: [] }],
      [['src/x.ts', 'return 1;\n']],
    );
    expect(resolved.layers[0]?.steps[0]?.location).toEqual({ state: 'broken' });
    expect(reviewIsActive(resolved.layers)).toBe(false);
  });

  it('leaves deleted files unexplained and gives broken pointers no covered lines', () => {
    const texts = new Map([['src/x.ts', 'return 2;\n']]);
    const resolved = resolve([{ ...step, published: [] }], [...texts]);
    expect(resolved.layers[0]?.steps[0]?.location).toEqual({ state: 'broken' });
    expect(
      unexplainedChanges(
        [
          { path: 'gone.ts', deleted: true, untracked: false },
          { path: 'src/x.ts', deleted: false, untracked: false },
        ],
        texts,
        {
          changed: new Map([['src/x.ts', new Set([1])]]),
          deleted: new Map(),
          binary: new Set(),
        },
        resolved.layers,
      ),
    ).toEqual([
      { path: 'gone.ts', ranges: [], deleted: true },
      { path: 'src/x.ts', ranges: [{ startLine: 1, endLine: 1 }] },
    ]);
  });
});
