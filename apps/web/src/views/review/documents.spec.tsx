import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import type { CommitChanges } from '../../domain/review';
import { DocumentView } from './documents';

const fileState = vi.hoisted(() => ({
  text: '# A document',
  byteLength: 12,
  unreadable: false,
  tree: [] as Array<{ path: string; kind: string; target?: string }>,
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

vi.mock('../../query/review', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../query/review')>()),
  useTextFile: () =>
    fileState.unreadable
      ? { kind: 'unreadable', reason: 'This file is binary.' }
      : fileState,
  useChanges: () => ({ status: { changes: [] } }),
  useCommit: () => commitState,
  useCommitLayers: () => null,
  useFileTree: () => ({
    data: { entries: fileState.tree },
    isPending: false,
  }),
}));
vi.mock('../../query/files', () => ({
  useFileDraft: (_scope: unknown, _path: string, text: string) => ({
    draft: {},
    state: { text, savedText: text, owner: null },
  }),
}));
vi.mock('../../query/preview-assets', () => ({
  useHtmlPreview: (_scope: unknown, _path: string, html: string) => ({
    data: { html, missing: [] },
    isPending: false,
  }),
  useAsset: () => ({
    data: { mediaType: 'image/png', base64: 'AA==' },
    isPending: false,
  }),
}));
vi.mock('../../query/history', () => ({
  useHistory: () => historyState,
}));
vi.mock('../workspace/preferences', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../workspace/preferences')>()),
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
    headerActions,
  }: {
    entries: Array<{ path: string; contents?: string }>;
    headerActions?: React.ReactNode;
    header?: () => React.ReactNode;
    toolbar?: (control: React.ReactNode) => React.ReactNode;
  }) => (
    <div data-testid="code-document">
      {toolbar?.(null)}
      {headerActions}
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
  fileState.unreadable = false;
  fileState.tree = [];
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
  it('opens markdown according to the persisted reader/source default', async () => {
    preferenceState.markdownDefault = 'source';
    const screen = await renderFile('README.md');

    await expect.element(screen.getByTestId('code-document')).toBeVisible();
    await expect
      .element(screen.getByTestId('markdown-reader'))
      .not.toBeInTheDocument();
  });

  it('opens HTML according to the persisted preview/source default', async () => {
    preferenceState.htmlDefault = 'preview';
    const screen = await renderFile('docs/index.html');

    await expect.element(screen.getByTestId('html-preview')).toBeVisible();
    await expect
      .element(screen.getByTestId('code-document'))
      .not.toBeInTheDocument();
  });

  it('lets the reader switch to source without changing the default', async () => {
    const screen = await renderFile('README.md');

    await expect.element(screen.getByTestId('markdown-reader')).toBeVisible();
    await screen.getByRole('tab', { name: 'Source' }).click();
    await expect.element(screen.getByTestId('code-document')).toBeVisible();
    await expect
      .element(screen.getByTestId('markdown-reader'))
      .not.toBeInTheDocument();
    await expect
      .element(screen.getByRole('tab', { name: 'Reader' }))
      .toBeVisible();
  });

  it('keeps the HTML preview toggle on the file toolbar', async () => {
    const screen = await renderFile('docs/index.html');

    await expect.element(screen.getByTestId('html-preview')).toBeVisible();
    await expect
      .element(screen.getByRole('tab', { name: 'Preview' }))
      .toBeVisible();
    await screen.getByRole('tab', { name: 'Source' }).click();
    await expect.element(screen.getByTestId('code-document')).toBeVisible();
    await expect
      .element(screen.getByRole('tab', { name: 'Preview' }))
      .toBeVisible();
  });

  it('does not follow symlink or submodule files', async () => {
    fileState.tree = [
      { path: 'docs/link', kind: 'symlink', target: 'docs/decisions' },
    ];
    const screen = await renderFile('docs/link');

    await expect.element(screen.getByText('Not shown')).toBeVisible();
    await expect
      .element(screen.getByText('Not followed: symlink to docs/decisions'))
      .toBeVisible();
    await expect
      .element(screen.getByTestId('code-document'))
      .not.toBeInTheDocument();

    await screen.unmount();
    fileState.tree = [{ path: 'vendor/tool', kind: 'submodule' }];
    const submodule = await renderFile('vendor/tool');
    await expect
      .element(submodule.getByText('Not followed: submodule'))
      .toBeVisible();
  });

  it('renders merge parent choices and commit metadata through the shared code document', async () => {
    const screen = await render(
      <DocumentView
        scope={scope}
        document={{ kind: 'commit', oid: commitState.commitOid }}
        onOpen={vi.fn()}
      />,
    );

    await expect
      .element(screen.getByText('Keep commit review compact'))
      .toBeVisible();
    expect((await screen.getByText(/First line/u).element()).textContent).toBe(
      'First line\n\n  Second line',
    );
    await expect.element(screen.getByText('main')).toBeVisible();
    await expect.element(screen.getByText('origin/main')).toBeVisible();
    await expect.element(screen.getByText('v1')).toBeVisible();
    await expect.element(screen.getByTitle('refs/heads/main')).toBeVisible();
    await expect.element(screen.getByText(/Fabio Fiorita/u)).toBeVisible();
    await expect
      .element(screen.getByRole('button', { name: 'Copy id' }))
      .toBeVisible();
    await expect.element(screen.getByTestId('code-document')).toBeVisible();
    const secondParent = screen.getByRole('tab', {
      name: /2nd parent.*ccccccc/u,
    });
    await secondParent.click();
    expect((await secondParent.element()).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('discloses when the displayed commit body is truncated', async () => {
    const firstCommit = historyState.commits[0];
    if (!firstCommit) throw new Error('Missing history fixture');
    firstCommit.bodyTruncated = true;

    const screen = await render(
      <DocumentView
        scope={scope}
        document={{ kind: 'commit', oid: commitState.commitOid }}
        onOpen={vi.fn()}
      />,
    );

    await expect
      .element(screen.getByText('Commit message truncated'))
      .toBeVisible();
  });

  it('identifies binary and submodule changes that have no code preview', async () => {
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

    const screen = await render(
      <DocumentView
        scope={scope}
        document={{ kind: 'commit', oid: commitState.commitOid }}
        onOpen={vi.fn()}
      />,
    );

    const fallback = screen.getByLabelText('Changes without code preview');
    await expect.element(fallback).toMatchTextContent('assets/logo.png');
    await expect
      .element(fallback)
      .toMatchTextContent('modified · Binary change');
    await expect.element(fallback).toMatchTextContent('vendor/tool');
    await expect
      .element(fallback)
      .toMatchTextContent('modified · Submodule change');
    await expect
      .element(fallback)
      .toMatchTextContent('Subproject commit 1111111..2222222');
  });

  it('keeps binary-only commits navigable without a code entry', async () => {
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

    const screen = await render(
      <DocumentView
        scope={scope}
        document={{ kind: 'commit', oid: commitState.commitOid }}
        onOpen={vi.fn()}
      />,
    );

    await expect.element(screen.getByText('assets/new-logo.png')).toBeVisible();
    await expect
      .element(screen.getByText(/added · Binary change/u))
      .toBeVisible();
  });
});

it('keeps the file header and copy action when text cannot be displayed', async () => {
  fileState.unreadable = true;
  const screen = await renderFile('assets/data.bin');
  await expect.element(screen.getByText('data.bin')).toBeVisible();
  await expect.element(screen.getByText('This file is binary.')).toBeVisible();
  await expect
    .element(screen.getByRole('button', { name: 'Copy path' }))
    .toBeVisible();
  await expect
    .element(screen.getByRole('button', { name: 'Try again' }))
    .not.toBeInTheDocument();
  await expect
    .element(screen.getByTestId('code-document'))
    .not.toBeInTheDocument();
});

it('previews images without passing their bytes through the text viewer', async () => {
  fileState.unreadable = true;
  const screen = await renderFile('assets/image.png');
  expect(
    (
      await screen.getByRole('img', { name: 'assets/image.png' }).element()
    ).getAttribute('src'),
  ).toBe('data:image/png;base64,AA==');
  await expect
    .element(screen.getByTestId('code-document'))
    .not.toBeInTheDocument();
});
