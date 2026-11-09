import { expect, it } from 'vitest';
import { retainedDiffPaths, reviewFilePosition } from './review-file';

it.each([
  [
    { path: 'new.ts', oldPath: 'old.ts', newPath: 'new.ts' },
    ['old.ts', 'new.ts'],
  ],
  [{ path: 'file.ts', oldPath: 'file.ts', newPath: 'file.ts' }, ['file.ts']],
  [{ path: 'deleted.ts', oldPath: 'deleted.ts' }, ['deleted.ts']],
])('requests the complete retained comparison for %j', (file, paths) => {
  expect(retainedDiffPaths(file)).toEqual(paths);
});

const layers = [
  {
    id: 'owner',
    steps: [
      { id: 'first', pointer: { path: 'shared.ts' } },
      { id: 'second', pointer: { path: 'shared.ts' } },
    ],
  },
  { id: 'consumer', steps: [{ id: 'third', pointer: { path: 'shared.ts' } }] },
];

it.each([
  ['second', 'decision:owner', 0, 1],
  ['third', 'decision:owner', 1, 0],
  [undefined, 'decision:consumer', 1, 0],
  ['missing', 'decision:owner', 0, 0],
] as const)(
  'keeps the selected stop %s when a file is reused',
  (step, place, decision, stop) => {
    expect(reviewFilePosition(layers, 'shared.ts', step, place)).toMatchObject({
      decision,
      stop,
    });
  },
);
