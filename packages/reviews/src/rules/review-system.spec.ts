import { expect, it } from 'vitest';
import { reviewFixture } from '../../spec/fixtures/review.ts';
import { reviewSystem } from './review-system.ts';

it('derives file facts from git and attaches annotations through step paths', () => {
  const review = reviewFixture({
    files: [
      {
        path: 'src/new.ts',
        oldMode: '000000',
        newMode: '100644',
        status: 'added',
      },
      {
        path: 'src/old.ts',
        oldMode: '100644',
        newMode: '000000',
        status: 'deleted',
      },
      {
        path: 'architecture/rules.mjs',
        oldMode: '100644',
        newMode: '100644',
        status: 'modified',
      },
    ],
    layers: [
      {
        id: 'layer',
        title: 'Delivery',
        summary: 'Explain delivery',
        lanes: ['Server'],
        fingerprint: 'f',
        steps: [
          {
            id: 'step',
            kind: 'changed',
            title: 'Deliver',
            text: 'Deliver feedback',
            lane: 0,
            pointer: { path: 'src/new.ts', startLine: 1, endLine: 2 },
            published: ['a', 'b'],
          },
        ],
      },
    ],
    diagram: {
      after: {
        boxes: [
          {
            id: 'claim',
            label: 'Agent label',
            layerId: 'layer',
            change: 'removed',
          },
        ],
        arrows: [],
      },
    },
  });
  expect(reviewSystem(review)).toEqual({
    kind: 'git-files',
    owners: [
      {
        path: 'architecture',
        files: [{ path: 'architecture/rules.mjs', change: 'changed' }],
        annotations: [],
      },
      {
        path: 'src',
        files: [
          { path: 'src/new.ts', change: 'new' },
          { path: 'src/old.ts', change: 'removed' },
        ],
        annotations: review.diagram?.after.boxes,
      },
    ],
    guards: ['architecture/rules.mjs'],
  });
});
it('records both ends of renames and retains deleted guards for inspection', () => {
  const review = reviewFixture({
    files: [
      {
        path: 'new/b.ts',
        oldPath: 'old/a.ts',
        newPath: 'new/b.ts',
        oldMode: '100644',
        newMode: '100644',
        status: 'renamed',
      },
      {
        path: 'architecture/retired.mjs',
        oldMode: '100644',
        newMode: '000000',
        status: 'deleted',
      },
    ],
  });
  expect(reviewSystem(review).owners.flatMap((owner) => owner.files)).toEqual([
    { path: 'architecture/retired.mjs', change: 'removed' },
    { path: 'new/b.ts', change: 'new' },
    { path: 'old/a.ts', change: 'removed' },
  ]);
  expect(reviewSystem(review).guards).toEqual(['architecture/retired.mjs']);
});
