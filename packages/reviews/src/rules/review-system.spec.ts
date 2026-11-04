import { expect, it } from 'vitest';
import { reviewFixture } from '../../spec/fixtures/review.ts';
import { reviewSystem } from './review-system.ts';

it('collapses actual imports into owners and includes only changed modules and direct neighbours', () => {
  const review = reviewFixture({
    files: [
      {
        path: 'packages/core/src/value.ts',
        status: 'modified',
        oldMode: '100644',
        newMode: '100644',
      },
    ],
    layers: [
      {
        id: 'decision',
        title: 'Core',
        summary: 'Core',
        lanes: ['Core'],
        fingerprint: 'f',
        steps: [
          {
            id: 'step',
            title: 'Value',
            text: 'Value',
            kind: 'changed',
            lane: 0,
            pointer: {
              path: 'packages/core/src/value.ts',
              startLine: 1,
              endLine: 1,
            },
            published: ['value'],
          },
        ],
      },
    ],
    diagram: {
      after: {
        boxes: [
          {
            id: 'claim',
            label: 'A claimed new owner',
            change: 'new',
            layerId: 'decision',
            decision: true,
            problem: 'Choose the value',
          },
        ],
        arrows: [{ from: 'claim', to: 'claim' }],
      },
    },
  });
  const graph = [
    {
      path: 'packages/core/src/value.ts',
      imports: ['packages/model/src/types.ts'],
      unresolved: 0,
    },
    {
      path: 'packages/model/src/types.ts',
      imports: ['packages/far/src/value.ts'],
      unresolved: 0,
    },
    {
      path: 'apps/web/src/features/review/view.ts',
      imports: ['packages/core/src/value.ts'],
      unresolved: 0,
    },
    { path: 'packages/far/src/value.ts', imports: [], unresolved: 0 },
  ];
  const result = reviewSystem(review, { base: graph, head: graph });
  expect(
    result.owners.map((owner) => ({
      path: owner.path,
      change: owner.change,
      layerIds: owner.layerIds,
    })),
  ).toEqual([
    { path: 'apps/web/src/features/review', change: undefined, layerIds: [] },
    { path: 'packages/core', change: 'changed', layerIds: ['decision'] },
    { path: 'packages/model', change: undefined, layerIds: [] },
  ]);
  expect(result.edges).toEqual([
    { from: 'apps/web/src/features/review', to: 'packages/core' },
    { from: 'packages/core', to: 'packages/model' },
  ]);
  expect(result.owners[1]?.annotations).toEqual(review.diagram?.after.boxes);
});
it('retains removed owners and edges, distinguishes a new owner from a file added to an existing owner, and lists only added guards', () => {
  const files = [
    {
      path: 'packages/old/src/value.ts',
      status: 'deleted' as const,
      oldMode: '100644',
      newMode: '000000',
    },
    {
      path: 'packages/new/src/value.ts',
      status: 'added' as const,
      oldMode: '000000',
      newMode: '100644',
    },
    {
      path: 'architecture/rule.mjs',
      status: 'added' as const,
      oldMode: '000000',
      newMode: '100644',
    },
    {
      path: 'architecture/removed.mjs',
      status: 'deleted' as const,
      oldMode: '100644',
      newMode: '000000',
    },
  ];
  const result = reviewSystem(reviewFixture({ files }), {
    base: [
      {
        path: 'packages/old/src/value.ts',
        imports: ['packages/existing/src/index.ts'],
        unresolved: 0,
      },
      { path: 'packages/existing/src/index.ts', imports: [], unresolved: 0 },
    ],
    head: [
      {
        path: 'packages/new/src/value.ts',
        imports: ['packages/existing/src/index.ts'],
        unresolved: 0,
      },
      { path: 'packages/existing/src/index.ts', imports: [], unresolved: 0 },
    ],
  });
  expect(
    result.owners
      .filter((owner) => owner.path.startsWith('packages/'))
      .map((owner) => [owner.path, owner.change]),
  ).toEqual([
    ['packages/existing', undefined],
    ['packages/new', 'new'],
    ['packages/old', 'removed'],
  ]);
  expect(result.edges).toEqual([
    { from: 'packages/new', to: 'packages/existing', change: 'new' },
    { from: 'packages/old', to: 'packages/existing', change: 'removed' },
  ]);
  expect(result.guards).toEqual(['architecture/rule.mjs']);
});
