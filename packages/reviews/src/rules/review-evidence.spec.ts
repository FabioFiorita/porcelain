import { describe, expect, it } from 'vitest';
import type { FileChange, TrackedComparison } from '@porcelain/kernel/models';
import type { LayerDraft } from '@porcelain/reviews/models';
import { reviewPaths, trackedComparisons } from './review-evidence.ts';

function tracked(
  scope: 'staged' | 'unstaged',
  path: string,
): TrackedComparison {
  return {
    scope,
    kind: 'modified',
    oldPath: path,
    newPath: path,
    oldMode: '100644',
    newMode: '100644',
    oldOid: undefined,
    newOid: undefined,
    supported: true,
  };
}

const changes: FileChange[] = [
  {
    path: 'README.md',
    fingerprint: 'r',
    comparisons: [
      tracked('staged', 'README.md'),
      tracked('unstaged', 'README.md'),
    ],
  },
  {
    path: 'notes.txt',
    fingerprint: 'n',
    comparisons: [{ scope: 'untracked', path: 'notes.txt' }],
  },
  {
    path: 'conflict.ts',
    fingerprint: undefined,
    comparisons: [
      {
        scope: 'unmerged',
        path: 'conflict.ts',
        conflict: 'both-modified',
        modes: ['100644', '100644', '100644', '100644'],
        oids: ['a', 'b', 'c'],
      },
    ],
  },
];

const layers: Pick<LayerDraft, 'steps'>[] = [
  {
    steps: ['README.md', 'src/app.ts', 'src/app.ts'].map((path, index) => ({
      id: `step-${index}`,
      lane: 0,
      title: 'Step',
      text: 'Explains',
      kind: 'changed',
      pointer: { path, startLine: 1, endLine: 1 },
    })),
  },
];

describe('reviewPaths', () => {
  it('reads every file a step points at and every changed file, each once', () => {
    expect(reviewPaths(layers, changes)).toEqual([
      'README.md',
      'src/app.ts',
      'notes.txt',
      'conflict.ts',
    ]);
  });

  it('reads only the step files when nothing changed', () => {
    expect(reviewPaths(layers, [])).toEqual(['README.md', 'src/app.ts']);
  });
});

describe('trackedComparisons', () => {
  it('asks for the staged and unstaged diffs, never for untracked or unmerged files', () => {
    expect(trackedComparisons(changes)).toEqual([
      tracked('staged', 'README.md'),
      tracked('unstaged', 'README.md'),
    ]);
  });

  it('asks for nothing when nothing changed', () => {
    expect(trackedComparisons([])).toEqual([]);
  });
});
