import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import type { CommitFile } from '../../domain/review';
import { DocumentView } from './documents';

const fileState = vi.hoisted(() => ({
  text: '# A document',
  byteLength: 12,
  unreadable: false,
  /** What the file's own folder says about it — not a listing of everything. */
  folder: [] as Array<{ name: string; kind: string; target?: string }>,
}));
const preferenceState = vi.hoisted(() => ({
  markdownDefault: 'reader' as 'reader' | 'source',
  htmlDefault: 'preview' as 'preview' | 'source',
}));
const commitState = vi.hoisted(() => ({
  commit: {
    oid: 'a'.repeat(40),
    parentOids: ['b'.repeat(40), 'c'.repeat(40)],
    author: { name: 'Fabio Fiorita', timestamp: '2026-09-14T12:00:00Z' },
    subject: 'Keep commit review compact',
    subjectTruncated: false,
    body: 'First line\n\n  Second line',
    bodyTruncated: false,
    refs: ['main', 'origin/main', 'v1'],
  },
  comparison: {
    kind: 'parent' as const,
    parentNumber: 1,
    baseOid: 'b'.repeat(40),
  },
  files: [
    {
      oldPath: 'README.md',
      newPath: 'README.md',
      status: 'modified' as const,
      oldMode: '100644',
      newMode: '100644',
    },
  ] as CommitFile[],
}));
/** Patches arrive separately from the file list, keyed by the file's paths. */
const patchState = vi.hoisted(() => ({
  patches: new Map<string, { kind: string; patch?: string; reason?: string }>(),
  failed: false,
  retry: () => {},
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
  useChanges: () => ({ changes: { changes: [] } }),
  useCommit: () => commitState,
  useCommitDiffs: () => ({
    patches: patchState.patches,
    isPending: false,
    isError: patchState.failed,
    retry: patchState.retry,
  }),
  useDirectory: () => ({ entries: fileState.folder }),
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
  fileState.folder = [];
  preferenceState.markdownDefault = 'reader';
  preferenceState.htmlDefault = 'preview';
  commitState.comparison.parentNumber = 1;
  commitState.files = [
    {
      oldPath: 'README.md',
      newPath: 'README.md',
      status: 'modified',
      oldMode: '100644',
      newMode: '100644',
    },
  ];
  patchState.failed = false;
  patchState.retry = () => {};
  patchState.patches = new Map([
    [
      'README.md',
      {
        kind: 'text',
        patch: '--- a/README.md\n+++ b/README.md\n@@ -1 +1 @@\n-old\n+new\n',
      },
    ],
  ]);
  commitState.commit.subject = 'Keep commit review compact';
  commitState.commit.bodyTruncated = false;
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
    fileState.folder = [
      { name: 'link', kind: 'symlink', target: 'docs/decisions' },
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
    fileState.folder = [{ name: 'tool', kind: 'submodule' }];
    const submodule = await renderFile('vendor/tool');
    await expect
      .element(submodule.getByText('Not followed: submodule'))
      .toBeVisible();
  });

  it('renders merge parent choices and commit metadata through the shared code document', async () => {
    const screen = await render(
      <DocumentView
        scope={scope}
        document={{ kind: 'commit', oid: commitState.commit.oid }}
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
    await expect.element(screen.getByTitle('main')).toBeVisible();
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
    // The commit's own details come with its file list now, not from the
    // history page, so a commit opened by link has them without one.
    commitState.commit.bodyTruncated = true;

    const screen = await render(
      <DocumentView
        scope={scope}
        document={{ kind: 'commit', oid: commitState.commit.oid }}
        onOpen={vi.fn()}
      />,
    );

    await expect
      .element(screen.getByText('Commit message truncated'))
      .toBeVisible();
  });

  it('identifies binary and submodule changes that have no code preview', async () => {
    commitState.files = [
      {
        oldPath: 'assets/logo.png',
        newPath: 'assets/logo.png',
        status: 'modified',
        oldMode: '100644',
        newMode: '100644',
      },
      {
        oldPath: 'vendor/tool',
        newPath: 'vendor/tool',
        status: 'modified',
        oldMode: '160000',
        newMode: '160000',
      },
    ];
    patchState.patches = new Map([
      ['assets/logo.png', { kind: 'binary' }],
      [
        'vendor/tool',
        {
          kind: 'text',
          patch:
            'diff --git a/vendor/tool b/vendor/tool\n-Subproject commit 1111111\n+Subproject commit 2222222\n',
        },
      ],
    ]);

    const screen = await render(
      <DocumentView
        scope={scope}
        document={{ kind: 'commit', oid: commitState.commit.oid }}
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
      .toMatchTextContent('Subproject commit 1111111');
  });

  /**
   * A patch that failed to arrive is not a patch still arriving. Without this
   * the file stays labelled as loading for as long as the commit is open,
   * with nothing to press.
   */
  it('says when a patch could not be read, and offers to try again', async () => {
    commitState.files = [
      {
        oldPath: 'src/domain/review.ts',
        newPath: 'src/domain/review.ts',
        status: 'modified',
        oldMode: '100644',
        newMode: '100644',
      },
    ];
    patchState.patches = new Map();
    patchState.failed = true;
    let retried = 0;
    patchState.retry = () => {
      retried += 1;
    };

    const screen = await render(
      <DocumentView
        scope={scope}
        document={{ kind: 'commit', oid: commitState.commit.oid }}
        onOpen={vi.fn()}
      />,
    );
    const fallback = screen.getByLabelText('Changes without code preview');
    await expect
      .element(fallback)
      .toMatchTextContent('The patch could not be read');
    await screen.getByRole('button', { name: 'Try again' }).click();
    expect(retried).toBe(1);
  });

  it('keeps binary-only commits navigable without a code entry', async () => {
    commitState.files = [
      {
        oldPath: null,
        newPath: 'assets/new-logo.png',
        status: 'added',
        oldMode: '000000',
        newMode: '100644',
      },
    ];
    patchState.patches = new Map([['assets/new-logo.png', { kind: 'binary' }]]);

    const screen = await render(
      <DocumentView
        scope={scope}
        document={{ kind: 'commit', oid: commitState.commit.oid }}
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
