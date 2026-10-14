import { expect, it } from 'vitest';
import { Schema } from 'effect';
import { documentTab } from './workspace-documents';
import { activateDocument, closeDocument } from './document-tabs';
import { changePane, openInPane } from './document-panes';
import {
  initialWorkspaceSnapshot,
  readWorkspaceSnapshot,
  restoreWorkspace,
  selectedDocument,
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
  expect(restored.left).toEqual({
    tabs: [documentTab(file)],
    active: '["file","README.md"]',
  });
  expect(restored.focused).toBe('left');
  expect(restored.mode).toBe('review');
  expect(
    restoreWorkspace(
      { ...initial, right: { tabs: [file], active: 'old' }, focused: 'right' },
      'files',
    ).left,
  ).toEqual(restored.left);
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
