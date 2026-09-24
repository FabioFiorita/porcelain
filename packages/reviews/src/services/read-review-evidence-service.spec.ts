import { describe, expect, it } from 'vitest';
import type {
  FileChange,
  TrackedComparison,
  UntrackedComparison,
} from '@porcelain/kernel/models';
import type { ReviewDiff } from '@porcelain/reviews/models';
import { InMemoryReviewTextReader } from '../../spec/fakes/in-memory-review-text-reader.ts';
import { ScriptedReviewDiffReader } from '../../spec/fakes/scripted-review-diff-reader.ts';
import { ScriptedReviewFingerprintReader } from '../../spec/fakes/scripted-review-fingerprint-reader.ts';
import { ScriptedReviewStatusReader } from '../../spec/fakes/scripted-review-status-reader.ts';
import { ReadReviewEvidenceService } from './read-review-evidence-service.ts';

const worktreeId = 'a'.repeat(64);
const otherWorktreeId = 'b'.repeat(64);

const modified: TrackedComparison = {
  scope: 'unstaged',
  kind: 'modified',
  oldPath: 'README.md',
  newPath: 'README.md',
  oldMode: '100644',
  newMode: '100644',
  oldOid: undefined,
  newOid: undefined,
  supported: true,
};
const untracked: UntrackedComparison = { scope: 'untracked', path: 'notes.md' };
const elsewhere: TrackedComparison = {
  ...modified,
  oldPath: 'other.md',
  newPath: 'other.md',
};

const changes: FileChange[] = [
  { path: 'README.md', fingerprint: 'readme', comparisons: [modified] },
  { path: 'notes.md', fingerprint: 'notes', comparisons: [untracked] },
  { path: 'other.md', fingerprint: 'other', comparisons: [elsewhere] },
];
const diff: ReviewDiff = {
  selection: { scope: 'unstaged', oldPath: 'README.md', newPath: 'README.md' },
  content: { kind: 'text', patch: '@@ -1 +1 @@\n-old\n+new\n' },
};
const layers = [
  {
    steps: [
      {
        id: 'step-1',
        lane: 0,
        title: 'Entry point',
        text: 'Where it starts',
        kind: 'context' as const,
        pointer: { path: 'src/main.ts', startLine: 1, endLine: 2 },
      },
      {
        id: 'step-2',
        lane: 0,
        title: 'Readme',
        text: 'The changed line',
        kind: 'changed' as const,
        pointer: { path: 'README.md', startLine: 1, endLine: 1 },
      },
    ],
  },
];

function service() {
  return new ReadReviewEvidenceService(
    new ScriptedReviewStatusReader(
      new Map([
        [worktreeId, [modified, untracked]],
        [otherWorktreeId, [elsewhere]],
      ]),
    ),
    new ScriptedReviewFingerprintReader(changes),
    new InMemoryReviewTextReader(
      new Map([
        ['README.md', 'new\n'],
        ['notes.md', 'note\n'],
        ['src/main.ts', 'start\nrun\n'],
      ]),
    ),
    new ScriptedReviewDiffReader([diff]),
  );
}

describe('ReadReviewEvidenceService', () => {
  it('fingerprints the changes the worktree status reports now', async () => {
    const evidence = await service().execute({ worktreeId, layers });
    expect(evidence.changes.map((change) => change.path)).toEqual([
      'README.md',
      'notes.md',
    ]);
  });

  it('reads the text of every path a step points at and every changed path', async () => {
    const evidence = await service().execute({ worktreeId, layers });
    expect(Object.fromEntries(evidence.texts)).toEqual({
      'src/main.ts': 'start\nrun\n',
      'README.md': 'new\n',
      'notes.md': 'note\n',
    });
  });

  it('reads the diffs of tracked changes and never of an untracked file', async () => {
    const evidence = await service().execute({ worktreeId, layers });
    expect(evidence.diffs).toEqual([diff]);
  });

  it('gathers nothing but the pointed-at texts for a worktree without changes', async () => {
    const evidence = await service().execute({
      worktreeId: 'c'.repeat(64),
      layers,
    });
    expect(evidence.changes).toEqual([]);
    expect([...evidence.texts.keys()]).toEqual(['src/main.ts', 'README.md']);
    expect(evidence.diffs).toEqual([]);
  });
});
