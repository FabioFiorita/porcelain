import { expect, it } from 'vitest';
import type { WalkthroughContent, DiffFile } from '../models/walkthrough.ts';
import { qualifyWalkthrough } from './qualify-walkthrough.ts';
const files: DiffFile[] = [
  {
    path: 'owner.ts',
    oldPath: 'before.ts',
    hunks: [{ oldStart: 2, oldEnd: 6, newStart: 5, newEnd: 10 }],
  },
  { path: 'support.ts', oldPath: undefined, hunks: [] },
];
const content: WalkthroughContent = {
  outcome: 'worth_knowing',
  title: 'The change',
  summary: 'A new owner.',
  growth: [],
  stops: [
    {
      title: 'One owner',
      explanation: 'Owns it.',
      attention: undefined,
      excerpts: [
        { path: 'owner.ts', side: 'new', start: 5, end: 8, caption: 'Valid' },
        {
          path: 'owner.ts',
          side: 'new',
          start: 9,
          end: 12,
          caption: 'Outside',
        },
        { path: 'other.ts', side: 'new', start: 5, end: 6, caption: 'Unknown' },
      ],
      files: [{ path: 'other.ts', note: 'Unknown' }],
      evidence: [{ assetId: 'missing', shows: 'Invented' }],
    },
  ],
  onlyInTranscript: [],
  stillUnclear: ['Unknown'],
  checks: undefined,
};
it('drops excerpts outside one real diff hunk, unmodified paths and unavailable evidence, and claims remaining files', () => {
  const result = qualifyWalkthrough(content, files, []);
  expect(result.stops[0]?.excerpts).toEqual([
    { path: 'owner.ts', side: 'new', start: 5, end: 8, caption: 'Valid' },
  ]);
  expect(result.stops[0]?.files).toEqual([]);
  expect(result.stops[0]?.evidence).toEqual([]);
  expect(result.stops[1]).toEqual({
    title: 'Everything else',
    explanation: 'These changed files complete the change.',
    attention: undefined,
    excerpts: [],
    evidence: [],
    files: [{ path: 'support.ts', note: 'Supporting change' }],
  });
});
it('requires no coverage and hides unanswered questions for nothing', () => {
  const result = qualifyWalkthrough(
    { ...content, outcome: 'nothing' },
    files,
    [],
  );
  expect(result.stops).toEqual([]);
  expect(result.stillUnclear).toEqual([]);
});
it('keeps old-side excerpts on renames and gives each file one stop', () => {
  const stop = {
    ...content.stops[0]!,
    excerpts: [
      {
        path: 'before.ts',
        side: 'old' as const,
        start: 2,
        end: 4,
        caption: 'Before',
      },
    ],
    files: [],
  };
  const result = qualifyWalkthrough(
    { ...content, stops: [stop, stop] },
    files,
    [],
  );
  expect(result.stops[0]?.excerpts).toEqual([
    { path: 'before.ts', side: 'old', start: 2, end: 4, caption: 'Before' },
  ]);
  expect(result.stops[1]?.excerpts).toEqual([]);
});
