import { expect, test } from 'vitest';
import { scheduledRegistry } from '../../../spec/kit/atom-registry';
import {
  documentSelectionState,
  phoneReviewComparison,
  reviewListOffset,
  reviewFileScope,
} from './store';

test('returning to Review restores its comparison, file-list place and original line-selection target', () => {
  const { registry, flush } = scheduledRegistry();
  const workspace = 'computer/project/worktree';
  const comparison = { kind: 'branch', base: 'refs/heads/checkpoint' } as const;
  const listOwner = JSON.stringify([workspace, comparison]);
  const document = {
    environmentId: 'computer',
    projectId: 'project',
    worktreeId: 'worktree',
    document: 'branch:checkpoint:src/summary.ts',
    comparison,
  };
  const selected = {
    range: { startLine: 12, endLine: 15, side: 'additions' as const },
    target: {
      filePath: 'src/summary.ts',
      comparison,
      revision: 'a'.repeat(40),
      contentFingerprint: 'b'.repeat(64),
    },
  };
  const leaveComparison = registry.mount(phoneReviewComparison(workspace));
  const leaveList = registry.mount(reviewListOffset(listOwner));
  const leaveSelection = registry.mount(documentSelectionState(document));
  const leaveScope = registry.mount(reviewFileScope(document.document));
  try {
    registry.set(phoneReviewComparison(workspace), comparison);
    registry.set(reviewListOffset(listOwner), 640);
    registry.set(documentSelectionState(document), selected);
    registry.set(reviewFileScope(document.document), 'unstaged');
    leaveComparison();
    leaveList();
    leaveSelection();
    leaveScope();
    flush();
    expect(registry.get(phoneReviewComparison(workspace))).toEqual(comparison);
    expect(registry.get(reviewListOffset(listOwner))).toBe(640);
    expect(registry.get(documentSelectionState(document))).toEqual(selected);
    expect(registry.get(reviewFileScope(document.document))).toBe('unstaged');
    expect(registry.get(phoneReviewComparison('another-workspace'))).toEqual({
      kind: 'worktree',
    });
    expect(
      registry.get(
        reviewListOffset(JSON.stringify([workspace, { kind: 'worktree' }])),
      ),
    ).toBe(0);
    expect(
      registry.get(
        documentSelectionState({ ...document, worktreeId: 'another-worktree' }),
      ),
    ).toBeUndefined();
    expect(
      registry.get(
        documentSelectionState({
          ...document,
          document: 'file:src/summary.ts',
        }),
      ),
    ).toBeUndefined();
    const stagedDocument = {
      ...document,
      document: 'review-file:src/summary.ts',
      comparison: { kind: 'worktree', scope: 'staged' } as const,
    };
    registry.set(documentSelectionState(stagedDocument), {
      ...selected,
      target: { ...selected.target, comparison: stagedDocument.comparison },
    });
    expect(
      registry.get(
        documentSelectionState({
          ...stagedDocument,
          comparison: { kind: 'worktree', scope: 'unstaged' },
        }),
      ),
    ).toBeUndefined();
  } finally {
    registry.dispose();
  }
});
