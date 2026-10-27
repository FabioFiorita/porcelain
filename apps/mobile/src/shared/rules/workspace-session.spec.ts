import { describe, expect, it } from 'vitest';
import { Schema } from 'effect';
import { documentTab } from './workspace-documents';
import { activateDocument, closeDocument } from './document-tabs';
import { changePane, openInPane } from './document-panes';
import {
  initialWorkspaceSnapshot,
  readWorkspaceSnapshot,
  restoreWorkspace,
  reviewPanelSelection,
  selectedDocument,
  showReview,
  workspaceSnapshot,
  workspaceSnapshotSchema,
} from './workspace-session';

it('round trips both pane selections and comparison through the persisted JSON boundary', () => {
  const source = restoreWorkspace(initialWorkspaceSnapshot(), 'history');
  const file = documentTab({ kind: 'file', path: 'src/app.css' });
  const diff = documentTab({
    kind: 'diff',
    oid: 'abc',
    parent: 2,
    path: 'src/app.css',
  });
  const session = {
    ...source,
    left: { tabs: [file], active: file.key },
    right: { tabs: [diff], active: diff.key },
    focused: 'right' as const,
    inspectorOpen: false,
    comparison: { kind: 'branch' as const, base: 'main' },
  };
  const codec = Schema.fromJsonString(workspaceSnapshotSchema);
  const json = Schema.encodeSync(codec)(workspaceSnapshot(session));
  const decoded = Schema.decodeUnknownSync(codec)(json);
  expect(decoded.right).toEqual({
    tabs: [{ kind: 'diff', oid: 'abc', parent: 2, path: 'src/app.css' }],
    active: '["diff","abc",2,"src/app.css"]',
  });
  const restored = restoreWorkspace(decoded, 'files');
  expect(restored).toEqual(session);
  expect(selectedDocument(restored, 'history')?.label).toBe(
    'src/app.css · abc · Parent 2',
  );
  expect(selectedDocument(restored, 'files')).toBeUndefined();
});

it('normalizes stale active keys, duplicates, and a focus pointing to a missing pane', () => {
  const initial = initialWorkspaceSnapshot();
  const file = { kind: 'file' as const, path: 'README.md' };
  const restored = restoreWorkspace(
    {
      ...initial,
      left: { tabs: [file, file], active: 'old' },
      focused: 'right',
    },
    'review',
  );
  expect(restored.left).toEqual({ tabs: [documentTab(file)], active: null });
  expect(restored.focused).toBe('left');
  expect(restored.mode).toBe('review');
  const side = restoreWorkspace(
    { ...initial, right: { tabs: [file], active: 'old' }, focused: 'right' },
    'files',
  );
  expect(side.left).toEqual({ tabs: [], active: null });
  expect(side.right).toEqual({
    tabs: [documentTab(file)],
    active: '["file","README.md"]',
  });
  expect(side.focused).toBe('right');
});

it('returns to the Review tab without closing documents in either pane', () => {
  const initial = restoreWorkspace(initialWorkspaceSnapshot(), 'files');
  const file = documentTab({ kind: 'file', path: 'README.md' });
  const commit = documentTab({ kind: 'commit', oid: 'abc', parent: 1 });
  const split = {
    ...initial,
    ...openInPane(openInPane(initial, file), commit, 'right'),
  };
  const review = showReview(split);
  expect(review.left).toEqual({ tabs: [file], active: null });
  expect(review.right).toEqual({ tabs: [commit], active: commit.key });
  expect(review.focused).toBe('left');
  expect(selectedDocument(review, 'files')?.label).toBe('README.md');
});

describe('selects exactly one Review panel row', () => {
  const initial = restoreWorkspace(initialWorkspaceSnapshot(), 'review');
  const uncommitted = { kind: 'worktree' as const };
  const reviewFile = documentTab({
    kind: 'review-file',
    path: 'src/app.css',
    comparison: uncommitted,
  });
  const branchFile = documentTab({
    kind: 'review-file',
    path: 'src/app.css',
    comparison: { kind: 'branch', base: 'main' },
  });
  const readme = documentTab({ kind: 'file', path: 'README.md' });
  const opened = { ...initial, ...openInPane(initial, reviewFile) };
  it.each([
    {
      state: 'the Review tab after opening a changed file',
      session: showReview(opened),
      selection: { kind: 'overview' },
    },
    {
      state: 'a changed file in the current comparison',
      session: opened,
      selection: { kind: 'file', path: 'src/app.css' },
    },
    {
      state: 'a changed file from another comparison',
      session: { ...initial, ...openInPane(initial, branchFile) },
      selection: undefined,
    },
    {
      state: 'a plain file after a changed file',
      session: { ...opened, ...openInPane(opened, readme) },
      selection: { kind: 'file', path: 'src/app.css' },
    },
    {
      state: 'a changed file in the focused side pane beside the Review tab',
      session: { ...initial, ...openInPane(initial, reviewFile, 'right') },
      selection: { kind: 'overview' },
    },
  ])('$state', ({ session, selection }) => {
    expect(reviewPanelSelection(session)).toEqual(selection);
  });
});

it('starts with a clean layout when saved structure or parent selection is invalid', () => {
  expect(readWorkspaceSnapshot({ version: 100 })).toEqual(
    initialWorkspaceSnapshot(),
  );
  expect(
    readWorkspaceSnapshot({
      ...initialWorkspaceSnapshot(),
      left: { tabs: [{ kind: 'commit', oid: 'abc', parent: 0 }], active: null },
    }),
  ).toEqual(initialWorkspaceSnapshot());
});

it('keeps header tabs and active documents together through opens, switches, persisted restore and the last close', () => {
  const initial = restoreWorkspace(initialWorkspaceSnapshot(), 'files');
  const first = documentTab({ kind: 'file', path: 'README.md' });
  const second = documentTab({ kind: 'file', path: 'src/main.ts' });
  const opened = {
    ...initial,
    ...openInPane(openInPane(initial, first), second),
  };
  const switched = {
    ...opened,
    ...changePane(opened, 'left', (tabs) => activateDocument(tabs, first.key)),
  };
  const codec = Schema.fromJsonString(workspaceSnapshotSchema);
  const restored = restoreWorkspace(
    Schema.decodeUnknownSync(codec)(
      Schema.encodeSync(codec)(workspaceSnapshot(switched)),
    ),
    'files',
  );
  expect(restored.left.tabs.map((tab) => tab.label)).toEqual([
    'README.md',
    'src/main.ts',
  ]);
  expect(restored.left.active).toBe('["file","README.md"]');
  expect(selectedDocument(restored, 'files')?.label).toBe('README.md');
  const remaining = changePane(restored, 'left', (tabs) =>
    closeDocument(tabs, first.key),
  );
  expect(remaining.left).toEqual({
    tabs: [second],
    active: '["file","src/main.ts"]',
  });
  const closed = {
    ...restored,
    ...changePane(remaining, 'left', (tabs) => closeDocument(tabs, second.key)),
  };
  expect(closed.left).toEqual({ tabs: [], active: null });
  expect(selectedDocument(closed, 'files')).toBeUndefined();
});

it.each([{ kind: 'worktree' }, { kind: 'branch', base: 'main' }] as const)(
  'preserves other saved documents when replacing an old %j overview with the pinned Review tab',
  (comparison) => {
    const initial = initialWorkspaceSnapshot();
    const file = { kind: 'file', path: 'docs/README.md' } as const;
    const commit = { kind: 'commit', oid: 'abc', parent: 2 } as const;
    const overviewKey = JSON.stringify([
      'review-overview',
      comparison.kind === 'worktree'
        ? ['worktree']
        : ['branch', comparison.base],
      null,
    ]);
    const restored = restoreWorkspace(
      readWorkspaceSnapshot({
        ...initial,
        left: {
          tabs: [file, { kind: 'review-overview', comparison }],
          active: overviewKey,
        },
        right: { tabs: [commit], active: '["commit","abc"]' },
        mode: 'history',
        inspectorOpen: false,
        comparison,
      }),
      'files',
    );
    expect(restored.left).toEqual({ tabs: [documentTab(file)], active: null });
    expect(restored.right).toEqual({
      tabs: [documentTab(commit)],
      active: '["commit","abc"]',
    });
    expect(restored.mode).toBe('history');
    expect(restored.inspectorOpen).toBe(false);
    expect(restored.comparison).toEqual(comparison);
  },
);
