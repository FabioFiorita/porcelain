import { reviewFileReadingKey } from './rules/navigation';
import {
  documentReadingLine,
  documentReadingStart,
} from '../../shared/application/document-reading';
import { expect, test } from 'vitest';
import { scheduledRegistry } from '../../../spec/kit/atom-registry';
import {
  phoneReviewComparison,
  reviewListOffset,
  reviewFileScope,
} from './store';

test('returning to Changes restores its comparison, file-list place and selected diff scope', () => {
  const { registry, flush } = scheduledRegistry();
  const workspace = 'computer/project/worktree';
  const comparison = { kind: 'branch', base: 'refs/heads/checkpoint' } as const;
  const owner = JSON.stringify([workspace, comparison]);
  const leaveComparison = registry.mount(phoneReviewComparison(workspace));
  const leaveList = registry.mount(reviewListOffset(owner));
  const leaveScope = registry.mount(reviewFileScope(owner));
  try {
    registry.set(phoneReviewComparison(workspace), comparison);
    registry.set(reviewListOffset(owner), 640);
    registry.set(reviewFileScope(owner), 'unstaged');
    leaveComparison();
    leaveList();
    leaveScope();
    flush();
    expect(registry.get(phoneReviewComparison(workspace))).toEqual(comparison);
    expect(registry.get(reviewListOffset(owner))).toBe(640);
    expect(registry.get(reviewFileScope(owner))).toBe('unstaged');
    expect(registry.get(phoneReviewComparison('another-workspace'))).toEqual({
      kind: 'worktree',
    });
    expect(
      registry.get(
        reviewListOffset(JSON.stringify([workspace, { kind: 'worktree' }])),
      ),
    ).toBe(0);
    expect(registry.get(reviewFileScope('another-document'))).toBeUndefined();
  } finally {
    registry.dispose();
  }
});

test('staged and unstaged diffs retain their own reading positions after switching and reopening', () => {
  const { registry } = scheduledRegistry();
  const workspace = 'computer/project/tree';
  const staged = reviewFileReadingKey(
    'src/file.ts',
    { kind: 'worktree' },
    'staged',
  );
  const unstaged = reviewFileReadingKey(
    'src/file.ts',
    { kind: 'worktree' },
    'unstaged',
  );
  try {
    registry.set(documentReadingLine({ workspace, document: staged }), 80);
    registry.set(documentReadingLine({ workspace, document: unstaged }), 12);
    expect(
      registry.get(
        documentReadingStart({
          workspace,
          document: staged,
          version: 'current',
        }),
      ),
    ).toBe(80);
    expect(
      registry.get(
        documentReadingStart({
          workspace,
          document: unstaged,
          version: 'current',
        }),
      ),
    ).toBe(12);
  } finally {
    registry.dispose();
  }
});
