import { describe, expect, it } from 'vitest';
import type { ResolvedStep } from '../models/resolved-review.ts';
import type { ReviewLayer, ReviewStep } from '../models/review.ts';
import {
  layerCodeMoved,
  resolveReview,
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
    expect(resolved.layers[0]?.fingerprint).not.toBe(
      resolve([step], [['src/x.ts', 'return 1;\n']]).layers[0]?.fingerprint,
    );
  });

  it('keeps an unreadable or transiently failed read changed and active', () => {
    const resolved = resolve([step], [], []);
    expect(resolved.layers[0]?.steps[0]?.location).toEqual({
      state: 'changed',
    });
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
  });

  it('resolves a legacy empty published block as broken even when the file exists', () => {
    const resolved = resolve(
      [{ ...step, published: [] }],
      [['src/x.ts', 'return 1;\n']],
    );
    expect(resolved.layers[0]?.steps[0]?.location).toEqual({ state: 'broken' });
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

describe('explicit pointer coverage', () => {
  it.each([
    {
      name: 'single line leaves its adjacent unrelated line unexplained',
      lines: ['const explained = 1;', 'const unmentioned = 2;'],
      startLine: 1,
      endLine: 1,
      ranges: [{ startLine: 2, endLine: 2 }],
    },
    {
      name: 'inclusive range leaves the next line unexplained',
      lines: ['const first = 1;', 'const second = 2;', 'const third = 3;'],
      startLine: 1,
      endLine: 2,
      ranges: [{ startLine: 3, endLine: 3 }],
    },
    {
      name: 'middle pointer leaves unrelated lines on both sides',
      lines: ['const first = 1;', 'const second = 2;', 'const third = 3;'],
      startLine: 2,
      endLine: 2,
      ranges: [
        { startLine: 1, endLine: 1 },
        { startLine: 3, endLine: 3 },
      ],
    },
    {
      name: 'whole hunk has no unexplained lines',
      lines: ['const first = 1;', 'const second = 2;', 'const third = 3;'],
      startLine: 1,
      endLine: 3,
      ranges: [],
    },
    {
      name: 'blank line does not change unrelated line coverage',
      lines: ['const explained = 1;', '', 'const unmentioned = 2;'],
      startLine: 1,
      endLine: 1,
      ranges: [{ startLine: 3, endLine: 3 }],
    },
    {
      name: 'partial function leaves its unmentioned behavior unexplained',
      lines: ['function run() {', '  save();', '  notify();', '}'],
      startLine: 1,
      endLine: 2,
      ranges: [{ startLine: 3, endLine: 3 }],
    },
  ])('$name', ({ lines, startLine, endLine, ranges }) => {
    const texts = new Map([['src/x.ts', lines.join('\n') + '\n']]);
    const resolution = resolveReview(
      {
        layers: [
          {
            ...layer,
            steps: [
              {
                ...step,
                pointer: { ...step.pointer, startLine, endLine },
                published: lines.slice(startLine - 1, endLine),
              },
            ],
          },
        ],
      },
      {
        texts,
        missing: new Set(),
        changes: [
          {
            path: 'src/x.ts',
            fingerprint: 'new',
            comparisons: [{ scope: 'untracked', path: 'src/x.ts' }],
          },
        ],
        diffs: [],
      },
    );
    expect(
      unexplainedChanges(
        resolution.changes,
        texts,
        resolution.diagnostics,
        resolution.layers,
      ),
    ).toEqual(ranges.length === 0 ? [] : [{ path: 'src/x.ts', ranges }]);
  });
});

describe('coverage boundaries', () => {
  it.each([
    {
      name: 'context',
      kind: 'context' as const,
      location: { state: 'current' as const, startLine: 1, endLine: 1 },
    },
    {
      name: 'broken',
      kind: 'changed' as const,
      location: { state: 'broken' as const },
    },
    {
      name: 'changed',
      kind: 'changed' as const,
      location: { state: 'changed' as const },
    },
  ])('$name steps cover no changed lines', ({ kind, location }) => {
    expect(
      unexplainedChanges(
        [{ path: 'src/x.ts', deleted: false, untracked: false }],
        new Map([['src/x.ts', 'return 1;\n']]),
        {
          changed: new Map([['src/x.ts', new Set([1])]]),
          deleted: new Map(),
          binary: new Set(),
        },
        [
          {
            ...layer,
            steps: [
              {
                ...step,
                kind,
                location,
                pointer: { ...step.pointer, textFingerprint: 'published' },
              },
            ],
          },
        ],
      ),
    ).toEqual([{ path: 'src/x.ts', ranges: [{ startLine: 1, endLine: 1 }] }]);
  });

  it('unions overlapping, committed and moved ranges without covering gaps', () => {
    const resolvedStep = (
      startLine: number,
      endLine: number,
      state: 'current' | 'committed',
    ): ResolvedStep => ({
      ...step,
      pointer: { ...step.pointer, textFingerprint: 'published' },
      location: { state, startLine, endLine },
    });
    expect(
      unexplainedChanges(
        [{ path: 'src/x.ts', deleted: false, untracked: false }],
        new Map([['src/x.ts', 'a();\nb();\nc();\nd();\ne();\nf();\n']]),
        {
          changed: new Map([['src/x.ts', new Set([1, 2, 3, 4, 5, 6])]]),
          deleted: new Map(),
          binary: new Set(),
        },
        [
          {
            ...layer,
            steps: [
              resolvedStep(2, 3, 'current'),
              resolvedStep(3, 4, 'current'),
              resolvedStep(6, 6, 'committed'),
            ],
          },
        ],
      ),
    ).toEqual([
      {
        path: 'src/x.ts',
        ranges: [
          { startLine: 1, endLine: 1 },
          { startLine: 5, endLine: 5 },
        ],
      },
    ]);
  });

  it('preserves binary and removed files and ignores empty change sets', () => {
    expect(
      unexplainedChanges(
        [
          { path: 'gone.ts', deleted: true, untracked: false },
          { path: 'image.png', deleted: false, untracked: false },
          { path: 'empty.ts', deleted: false, untracked: true },
        ],
        new Map(),
        {
          changed: new Map(),
          deleted: new Map(),
          binary: new Set(['image.png']),
        },
        [],
      ),
    ).toEqual([
      { path: 'gone.ts', ranges: [], deleted: true },
      { path: 'image.png', ranges: [], binary: true },
    ]);
  });

  it('keeps a pure deletion beside a pointed line unexplained', () => {
    const texts = new Map([
      ['src/x.ts', 'const explained = 1;\nconst survivor = 3;\n'],
    ]);
    const resolution = resolveReview(
      {
        layers: [
          {
            ...layer,
            steps: [{ ...step, published: ['const explained = 1;'] }],
          },
        ],
      },
      {
        texts,
        missing: new Set(),
        changes: [
          {
            path: 'src/x.ts',
            fingerprint: 'new',
            comparisons: [
              {
                scope: 'unstaged',
                kind: 'modified',
                oldPath: 'src/x.ts',
                newPath: 'src/x.ts',
                oldMode: '100644',
                newMode: '100644',
                oldOid: undefined,
                newOid: undefined,
                supported: true,
              },
            ],
          },
        ],
        diffs: [
          {
            selection: {
              scope: 'unstaged',
              oldPath: 'src/x.ts',
              newPath: 'src/x.ts',
            },
            content: {
              kind: 'text',
              patch:
                '@@ -1,3 +1,2 @@\n const explained = 1;\n-const removed = 2;\n const survivor = 3;\n',
            },
          },
        ],
      },
    );
    expect(
      unexplainedChanges(
        resolution.changes,
        texts,
        resolution.diagnostics,
        resolution.layers,
      ),
    ).toEqual([{ path: 'src/x.ts', ranges: [{ startLine: 2, endLine: 2 }] }]);
  });
});

describe('code moved since a decision was explained', () => {
  const whole: ReviewStep = {
    ...step,
    id: 'whole',
    pointer: { path: 'src/x.ts', startLine: 1, endLine: 2 },
    published: ['const one = 1;', 'return one;'],
  };
  it.for([
    {
      name: 'its lines are unchanged',
      steps: [step],
      text: 'return 1;\n',
      missing: [],
      moved: false,
    },
    {
      name: 'its lines shifted down',
      steps: [step],
      text: 'const a = 0;\nreturn 1;\n',
      missing: [],
      moved: false,
    },
    {
      name: 'its lines were edited',
      steps: [step],
      text: 'return 2;\n',
      missing: [],
      moved: true,
    },
    {
      name: 'its file was deleted',
      steps: [step],
      text: undefined,
      missing: ['src/x.ts'],
      moved: true,
    },
    {
      name: 'its file could not be read',
      steps: [step],
      text: undefined,
      missing: [],
      moved: false,
    },
    {
      name: 'one line of a whole-file anchor changed',
      steps: [whole],
      text: 'const one = 1;\nreturn 2;\n',
      missing: [],
      moved: true,
    },
    {
      name: 'a whole-file anchor is unchanged',
      steps: [whole],
      text: 'const one = 1;\nreturn one;\n',
      missing: [],
      moved: false,
    },
  ])('reports $moved when $name', ({ steps, text, missing, moved }) => {
    expect(
      layerCodeMoved(
        { steps },
        {
          texts: new Map(text === undefined ? [] : [['src/x.ts', text]]),
          missing: new Set(missing),
        },
      ),
    ).toBe(moved);
  });
});
