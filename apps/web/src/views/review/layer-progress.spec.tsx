import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import type { Change, ChangeList, ReviewChangeItem } from '../../domain/review';
import { DocumentView } from './documents';

const state = vi.hoisted(() => ({
  changes: [] as ReviewChangeItem[],
  bulkEntries: [] as ReviewChangeItem[],
}));

const scope = {
  projectId: 'project',
  worktreeId: 'worktree',
};

const staged: Extract<Change, { kind: string }> = {
  scope: 'staged',
  kind: 'modified',
  oldPath: 'same.ts',
  newPath: 'same.ts',
  oldMode: '100644',
  newMode: '100644',
  oldOid: null,
  newOid: null,
  supported: true,
};
const unstaged = { ...staged, scope: 'unstaged' as const };
const otherLayerChange: Extract<Change, { kind: string }> = {
  scope: 'unstaged',
  kind: 'modified',
  oldPath: 'other.ts',
  newPath: 'other.ts',
  oldMode: '100644',
  newMode: '100644',
  oldOid: null,
  newOid: null,
  supported: true,
};

const list: ChangeList = {
  environmentId: '7fe18f78-1477-4c19-a42b-cdd42f862151',
  worktreeId: scope.worktreeId,
  statusToken: 'a'.repeat(64),
  headOid: 'b'.repeat(40),
  branch: null,
  changes: [
    {
      path: 'same.ts',
      fingerprint: 'c'.repeat(64),
      comparisons: [staged, unstaged],
    },
    {
      path: 'other.ts',
      fingerprint: 'c'.repeat(64),
      comparisons: [otherLayerChange],
    },
  ],
};

const layer = {
  id: 'layer-a',
  title: 'First layer',
  files: [
    { path: 'same.ts', scope: 'staged' as const },
    { path: 'same.ts', scope: 'unstaged' as const },
    { path: 'missing.ts', scope: 'unstaged' as const },
  ],
};

function changeEntry(
  path: string,
  reviewStatus: ReviewChangeItem['reviewStatus'],
  change: Extract<Change, { kind: string }> = staged,
): ReviewChangeItem {
  return {
    path,
    fingerprint: 'c'.repeat(64),
    comparisons: [change],
    environmentId: list.environmentId,
    worktreeId: list.worktreeId,
    statusToken: list.statusToken,
    reviewStatus,
  };
}

vi.mock('../../query/review', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../query/review')>()),
  useChanges: () => ({
    changes: list,
    layers: {
      worktreeId: scope.worktreeId,
      revision: 1,
      layers: [layer],
    },
  }),
  // The real hook narrows to the paths it is given, so the fake does too:
  // what this spec asks is whether the layer view asks for its own files.
  useReviewChanges: (_scope: unknown, paths?: readonly string[]) =>
    paths
      ? state.changes.filter((entry) => paths.includes(entry.path))
      : state.changes,
}));
vi.mock('./reviewed-control', () => ({
  MarkAllReviewed: ({ entries }: { entries: readonly ReviewChangeItem[] }) => {
    state.bulkEntries = [...entries];
    return <button type="button">Mark layer reviewed</button>;
  },
  ReviewedControl: () => null,
}));
vi.mock('./review-code-document', () => ({
  ReviewCodeDocument: ({
    paths,
    header,
    toolbar,
  }: {
    paths?: readonly string[];
    header?: () => React.ReactNode;
    toolbar?: (control: React.ReactNode) => React.ReactNode;
  }) => (
    <div data-testid="code-document">
      {toolbar?.(null)}
      {paths?.map((path) => (
        <span key={path}>{path}</span>
      ))}
      {header?.()}
    </div>
  ),
}));
vi.mock('../../query/history', () => ({
  useHistory: () => ({ commits: [] }),
}));
vi.mock('../workspace/preferences', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../workspace/preferences')>()),
  usePreferences: () => ({
    preferences: { markdownDefault: 'reader', htmlDefault: 'preview' },
  }),
}));

function renderLayer() {
  return render(
    <DocumentView
      scope={scope}
      document={{ kind: 'layer', layerId: layer.id }}
      onOpen={vi.fn()}
    />,
  );
}

afterEach(() => {
  state.changes = [];
  state.bulkEntries = [];
});

describe('layer review progress', () => {
  it('counts declared missing paths and excludes changes from other layers', async () => {
    state.changes = [
      changeEntry('same.ts', 'reviewed'),
      changeEntry('other.ts', 'reviewed', otherLayerChange),
    ];

    const screen = await renderLayer();

    await expect.element(screen.getByText('1/2')).toBeVisible();
    await expect
      .element(
        screen.getByRole('progressbar', { name: '1 of 2 files reviewed' }),
      )
      .toBeInTheDocument();
    expect(state.bulkEntries.map((entry) => entry.path)).toEqual(['same.ts']);
    await expect
      .element(screen.getByRole('button', { name: 'Mark layer reviewed' }))
      .toBeVisible();
  });

  it('updates the toolbar counter when reviewed marks change', async () => {
    state.changes = [
      changeEntry('same.ts', 'unreviewed'),
      changeEntry('missing.ts', 'unreviewed', unstaged),
    ];
    const view = await renderLayer();

    await expect.element(view.getByText('0/2')).toBeVisible();
    state.changes = [
      changeEntry('same.ts', 'reviewed'),
      changeEntry('missing.ts', 'reviewed', unstaged),
    ];
    await view.rerender(
      <DocumentView
        scope={scope}
        document={{ kind: 'layer', layerId: layer.id }}
        onOpen={vi.fn()}
      />,
    );

    await expect.element(view.getByText('2/2')).toBeVisible();
  });
});
