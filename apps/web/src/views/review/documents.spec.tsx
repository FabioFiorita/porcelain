// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CommitChanges } from '../../domain/review';
import { DocumentView } from './documents';

const fileState = vi.hoisted(() => ({
  text: '# A document',
  byteLength: 12,
  unreadable: false,
}));
const preferenceState = vi.hoisted(() => ({
  markdownDefault: 'reader' as 'reader' | 'source',
  htmlDefault: 'preview' as 'preview' | 'source',
}));
const commitState = vi.hoisted(() => ({
  commitOid: 'a'.repeat(40),
  parentOids: ['b'.repeat(40), 'c'.repeat(40)],
  comparison: {
    kind: 'parent' as const,
    parentNumber: 1,
    baseOid: 'b'.repeat(40),
  },
  changes: [
    {
      oldPath: 'README.md',
      newPath: 'README.md',
      status: 'modified' as const,
      oldMode: '100644',
      newMode: '100644',
      patch: {
        kind: 'text' as const,
        text: '--- a/README.md\n+++ b/README.md\n@@ -1 +1 @@\n-old\n+new\n',
      },
    },
  ] as CommitChanges['changes'],
}));
const historyState = vi.hoisted(() => ({
  commits: [
    {
      oid: 'a'.repeat(40),
      parentOids: ['b'.repeat(40), 'c'.repeat(40)],
      author: { name: 'Fabio Fiorita', timestamp: '2026-09-14T12:00:00Z' },
      subject: 'Keep commit review compact',
      subjectTruncated: false,
      body: 'First line\n\n  Second line',
      bodyTruncated: false,
      refs: ['refs/heads/main', 'refs/remotes/origin/main', 'refs/tags/v1'],
    },
  ],
}));

vi.mock('../../query/review', () => ({
  useTextFile: () =>
    fileState.unreadable
      ? { kind: 'unreadable', reason: 'This file is binary.' }
      : fileState,
  useChanges: () => ({ status: { changes: [] } }),
  useCommit: () => commitState,
}));
vi.mock('../../query/history', () => ({
  useHistory: () => historyState,
}));
vi.mock('../workspace/preferences', () => ({
  usePreferences: () => ({ preferences: preferenceState }),
}));
vi.mock('./markdown-view', () => ({
  MarkdownView: ({ text }: { text: string }) => (
    <div data-testid="markdown-reader">{text}</div>
  ),
}));
vi.mock('./html-frame', () => ({
  HtmlFrame: ({ html }: { html: string }) => (
    <div data-testid="html-preview">{html}</div>
  ),
}));
vi.mock('./code-document', () => ({
  CodeDocument: ({
    entries,
    header,
    toolbar,
  }: {
    entries: Array<{ path: string; contents?: string }>;
    header?: () => React.ReactNode;
    toolbar?: (control: React.ReactNode) => React.ReactNode;
  }) => (
    <div data-testid="code-document">
      {toolbar?.(null)}
      {entries.map((entry) => (
        <span key={entry.path}>
          {entry.path}
          {entry.contents}
        </span>
      ))}
      {header?.()}
    </div>
  ),
}));

const scope = {
  projectId: 'project',
  worktreeId: 'worktree',
};

function renderFile(path: string) {
  return render(
    <DocumentView
      scope={scope}
      document={{ kind: 'file', path }}
      onOpen={vi.fn()}
    />,
  );
}

afterEach(() => {
  cleanup();
  fileState.unreadable = false;
  preferenceState.markdownDefault = 'reader';
  preferenceState.htmlDefault = 'preview';
  commitState.comparison.parentNumber = 1;
  commitState.changes = [
    {
      oldPath: 'README.md',
      newPath: 'README.md',
      status: 'modified',
      oldMode: '100644',
      newMode: '100644',
      patch: {
        kind: 'text',
        text: '--- a/README.md\n+++ b/README.md\n@@ -1 +1 @@\n-old\n+new\n',
      },
    },
  ];
  const firstCommit = historyState.commits[0];
  if (firstCommit) {
    firstCommit.subject = 'Keep commit review compact';
    firstCommit.bodyTruncated = false;
  }
});

describe('file document display defaults', () => {
  it('opens markdown according to the persisted reader/source default', () => {
    preferenceState.markdownDefault = 'source';
    renderFile('README.md');

    expect(screen.getByTestId('code-document')).toBeTruthy();
    expect(screen.queryByTestId('markdown-reader')).toBeNull();
  });

  it('opens HTML according to the persisted preview/source default', () => {
    preferenceState.htmlDefault = 'preview';
    renderFile('docs/index.html');

    expect(screen.getByTestId('html-preview')).toBeTruthy();
    expect(screen.queryByTestId('code-document')).toBeNull();
  });

  it('lets the reader switch to source without changing the default', async () => {
    const user = userEvent.setup();
    renderFile('README.md');

    expect(screen.getByTestId('markdown-reader')).toBeTruthy();
    await user.click(screen.getByRole('tab', { name: 'Source' }));
    expect(screen.getByTestId('code-document')).toBeTruthy();
    expect(screen.queryByTestId('markdown-reader')).toBeNull();
  });

  it('renders merge parent choices and commit metadata through the shared code document', async () => {
    const user = userEvent.setup();
    render(
      <DocumentView
        scope={scope}
        document={{ kind: 'commit', oid: commitState.commitOid }}
        onOpen={vi.fn()}
      />,
    );

    expect(screen.getByText('Keep commit review compact')).toBeTruthy();
    const body = screen.getByText(/First line/u);
    expect(body.textContent).toBe('First line\n\n  Second line');
    expect(screen.getByText('main')).toBeTruthy();
    expect(screen.getByText('origin/main')).toBeTruthy();
    expect(screen.getByText('v1')).toBeTruthy();
    expect(screen.getByTitle('refs/heads/main')).toBeTruthy();
    expect(screen.getByText(/Fabio Fiorita/u)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy id' })).toBeTruthy();
    expect(screen.getByTestId('code-document')).toBeTruthy();
    const secondParent = screen.getByRole('tab', {
      name: /2nd parent.*ccccccc/u,
    });
    await user.click(secondParent);
    expect(secondParent.getAttribute('aria-selected')).toBe('true');
  });

  it('discloses when the displayed commit body is truncated', () => {
    const firstCommit = historyState.commits[0];
    if (!firstCommit) throw new Error('Missing history fixture');
    firstCommit.bodyTruncated = true;

    render(
      <DocumentView
        scope={scope}
        document={{ kind: 'commit', oid: commitState.commitOid }}
        onOpen={vi.fn()}
      />,
    );

    expect(screen.getByText('Commit message truncated')).toBeTruthy();
  });

  it('identifies binary and submodule changes that have no code preview', () => {
    commitState.changes = [
      {
        oldPath: 'assets/logo.png',
        newPath: 'assets/logo.png',
        status: 'modified',
        oldMode: '100644',
        newMode: '100644',
        patch: { kind: 'binary' },
      },
      {
        oldPath: 'vendor/tool',
        newPath: 'vendor/tool',
        status: 'modified',
        oldMode: '160000',
        newMode: '160000',
        patch: {
          kind: 'submodule',
          text: 'Subproject commit 1111111..2222222',
        },
      },
    ];

    render(
      <DocumentView
        scope={scope}
        document={{ kind: 'commit', oid: commitState.commitOid }}
        onOpen={vi.fn()}
      />,
    );

    const fallback = screen.getByLabelText('Changes without code preview');
    expect(fallback.textContent).toContain('assets/logo.png');
    expect(fallback.textContent).toContain('modified · Binary change');
    expect(fallback.textContent).toContain('vendor/tool');
    expect(fallback.textContent).toContain('modified · Submodule change');
    expect(fallback.textContent).toContain(
      'Subproject commit 1111111..2222222',
    );
  });

  it('keeps binary-only commits navigable without a code entry', () => {
    commitState.changes = [
      {
        oldPath: null,
        newPath: 'assets/new-logo.png',
        status: 'added',
        oldMode: '000000',
        newMode: '100644',
        patch: { kind: 'binary' },
      },
    ];

    render(
      <DocumentView
        scope={scope}
        document={{ kind: 'commit', oid: commitState.commitOid }}
        onOpen={vi.fn()}
      />,
    );

    expect(screen.getByText('assets/new-logo.png')).toBeTruthy();
    expect(screen.getByText(/added · Binary change/u)).toBeTruthy();
  });
});

it('keeps the file header and copy action when text cannot be displayed', () => {
  fileState.unreadable = true;
  renderFile('assets/image.png');
  expect(screen.getByText('image.png')).toBeTruthy();
  expect(screen.getByText('This file is binary.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Copy path' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  expect(screen.queryByTestId('code-document')).toBeNull();
});
