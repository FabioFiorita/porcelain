import { expect, it } from 'vitest';
import { Option, Schema } from 'effect';
import {
  documentMode,
  documentTab,
  workspaceDocumentSchema,
  pullRequestDocumentSchema,
  type WorkspaceDocument,
} from './workspace-documents';
import { emptyDocuments, openDocument } from './document-tabs';

it('rejects malformed persisted documents before reading server content', () => {
  const decode = Schema.decodeUnknownOption(workspaceDocumentSchema);
  expect(
    decode({ kind: 'diff', oid: 'abc', path: 'README.md', parent: 0 }),
  ).toEqual(Option.none());
  expect(decode({ kind: 'commit', oid: 'abc', parent: 1.5 })).toEqual(
    Option.none(),
  );
  expect(decode({ kind: 'file', path: 7 })).toEqual(Option.none());
  expect(
    decode({
      kind: 'review-file',
      path: 'README.md',
      comparison: { kind: 'unknown' },
    }),
  ).toEqual(Option.none());
});

it('names a file by its leaf while identifying it by its complete path', () => {
  expect(documentTab({ kind: 'file', path: 'docs/README.md' })).toEqual({
    kind: 'file',
    path: 'docs/README.md',
    key: '["file","docs/README.md"]',
    title: 'README.md',
    label: 'docs/README.md',
    closable: true,
  });
  expect(documentTab({ kind: 'file', path: 'README.md' }).key).toBe(
    '["file","README.md"]',
  );
});

it('keeps the same path distinct across source files and review comparisons', () => {
  const documents: readonly WorkspaceDocument[] = [
    { kind: 'file', path: 'README.md' },
    {
      kind: 'review-file',
      path: 'README.md',
      comparison: { kind: 'worktree' },
    },
    { kind: 'review-file', path: 'README.md', comparison: { kind: 'branch' } },
    {
      kind: 'review-file',
      path: 'README.md',
      comparison: { kind: 'branch', base: 'refs/heads/main' },
    },
  ];
  let state = emptyDocuments<ReturnType<typeof documentTab>>();
  for (const document of documents)
    state = openDocument(state, documentTab(document));
  expect(state.tabs.map((tab) => tab.key)).toEqual([
    '["file","README.md"]',
    '["review-file",["worktree"],"README.md"]',
    '["review-file",["branch",null],"README.md"]',
    '["review-file",["branch","refs/heads/main"],"README.md"]',
  ]);
  expect(state.tabs[3]).toEqual({
    kind: 'review-file',
    path: 'README.md',
    comparison: { kind: 'branch', base: 'refs/heads/main' },
    key: '["review-file",["branch","refs/heads/main"],"README.md"]',
    title: 'README.md',
    label: 'README.md · Branch · refs/heads/main',
    closable: true,
  });
});

it('reuses a commit tab across parent changes while keeping merge diffs separate', () => {
  const oid = '0123456789abcdef';
  const first = documentTab({ kind: 'commit', oid, parent: 1 });
  const second = documentTab({ kind: 'commit', oid, parent: 2 });
  expect(second).toEqual({
    kind: 'commit',
    oid,
    parent: 2,
    key: '["commit","0123456789abcdef"]',
    title: '0123456',
    label: 'Commit 0123456 · Parent 2',
    closable: true,
  });
  expect(second.key).toBe(first.key);
  const diffs = [1, 2].map((parent) =>
    documentTab({ kind: 'diff', oid, parent, path: 'docs/README.md' }),
  );
  expect(diffs.map((tab) => tab.key)).toEqual([
    '["diff","0123456789abcdef",1,"docs/README.md"]',
    '["diff","0123456789abcdef",2,"docs/README.md"]',
  ]);
  expect(diffs[1]?.label).toBe('docs/README.md · 0123456 · Parent 2');
});

it.each([
  [{ kind: 'file', path: 'README.md' }, 'files'],
  [
    {
      kind: 'review-file',
      path: 'README.md',
      comparison: { kind: 'worktree' },
    },
    'review',
  ],
  [{ kind: 'commit', oid: '0123456', parent: 1 }, 'history'],
  [{ kind: 'diff', oid: '0123456', parent: 1, path: 'README.md' }, 'history'],
] satisfies readonly (readonly [WorkspaceDocument, string])[])(
  'classifies %j under its inspector mode %s',
  (document, mode) => expect(documentMode(document)).toBe(mode),
);

it('scopes pull-request tabs by computer, review and number while retaining a return tab', () => {
  const file = documentTab({ kind: 'file', path: 'README.md' });
  const first = documentTab({
    kind: 'pull-request',
    environmentId: 'one',
    projectId: 'project',
    reviewId: 'review',
    number: 42,
  });
  const other = documentTab({
    kind: 'pull-request',
    environmentId: 'two',
    projectId: 'project',
    reviewId: 'review',
    number: 42,
  });
  const relinked = documentTab({
    kind: 'pull-request',
    environmentId: 'one',
    projectId: 'project',
    reviewId: 'review',
    number: 43,
  });
  const opened = openDocument(
    openDocument(emptyDocuments<ReturnType<typeof documentTab>>(), file),
    first,
  );
  expect(opened.tabs.map((tab) => tab.title)).toEqual(['README.md', 'PR #42']);
  expect(opened.active).toBe('["pull-request","one","review",42]');
  expect(other.key).toBe('["pull-request","two","review",42]');
  expect(relinked.key).toBe('["pull-request","one","review",43]');
  expect(documentMode(first)).toBe('review');
  const decode = Schema.decodeUnknownOption(pullRequestDocumentSchema);
  expect(decode({ ...first, number: 0 })).toEqual(Option.none());
  expect(decode({ ...first, environmentId: undefined })).toEqual(Option.none());
});
