import type { FileChange, TrackedComparison } from '@porcelain/kernel/models';
import type { LayerDraft } from '@porcelain/reviews/models';
import { describe, expect, it } from 'vitest';
import { publishedLines, reviewPaths } from './review-evidence.ts';

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
});

describe('publishedLines', () => {
  it('publishes existing lines without treating the trailing newline as another line', () => {
    expect(
      publishedLines('one\ntwo\n', {
        path: 'src/x.ts',
        startLine: 1,
        endLine: 2,
      }),
    ).toEqual(['one', 'two']);
  });
  it.each([
    { name: 'missing file', text: undefined, startLine: 1, endLine: 2 },
    {
      name: 'end beyond the file',
      text: 'one\ntwo\n',
      startLine: 1,
      endLine: 3,
    },
    {
      name: 'start beyond the file',
      text: 'one\ntwo\n',
      startLine: 3,
      endLine: 3,
    },
    { name: 'empty file', text: '', startLine: 1, endLine: 1 },
  ])(
    'rejects $name rather than publishing an empty block',
    ({ text, startLine, endLine }) => {
      expect(
        publishedLines(text, { path: 'src/x.ts', startLine, endLine }),
      ).toBeUndefined();
    },
  );
});
