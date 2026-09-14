// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Change, ReviewEvidenceItem, Status } from '../../domain/review';
import { changePath } from '../../domain/review';
import { DocumentView } from './documents';

const state = vi.hoisted(() => ({
  evidence: [] as ReviewEvidenceItem[],
  bulkEntries: [] as ReviewEvidenceItem[],
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
  supported: true,
};

const status: Status = {
  environmentId: 'environment',
  worktreeId: scope.worktreeId,
  statusToken: 'a'.repeat(64),
  consistency: 'best-effort',
  headOid: 'b'.repeat(40),
  changes: [staged, unstaged, otherLayerChange],
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

function evidenceEntry(
  path: string,
  reviewStatus: ReviewEvidenceItem['reviewStatus'],
  change: Extract<Change, { kind: string }> = staged,
): ReviewEvidenceItem {
  return {
    path,
    fingerprint: 'c'.repeat(64),
    comparisons: [
      {
        change,
        content: {
          kind: 'diff',
          content: { kind: 'text', patch: '' },
        },
      },
    ],
    environmentId: status.environmentId,
    worktreeId: status.worktreeId,
    statusToken: status.statusToken,
    consistency: 'best-effort',
    reviewStatus,
  };
}

vi.mock('../../query/review', () => ({
  useChanges: () => ({
    status,
    layers: {
      worktreeId: scope.worktreeId,
      revision: 1,
      layers: [layer],
    },
  }),
  useReviewEvidence: () => state.evidence,
}));
vi.mock('./reviewed-control', () => ({
  MarkAllReviewed: ({
    entries,
  }: {
    entries: readonly ReviewEvidenceItem[];
  }) => {
    state.bulkEntries = [...entries];
    return <button type="button">Mark layer reviewed</button>;
  },
}));
vi.mock('./review-code-document', () => ({
  ReviewCodeDocument: ({
    changes,
    header,
    toolbar,
  }: {
    changes?: readonly Change[];
    header?: () => React.ReactNode;
    toolbar?: (control: React.ReactNode) => React.ReactNode;
  }) => (
    <div data-testid="code-document">
      {toolbar?.(null)}
      {changes?.map((change) => (
        <span key={`${change.scope}:${changePath(change)}`}>
          {change.scope}:{changePath(change)}
        </span>
      ))}
      {header?.()}
    </div>
  ),
}));
vi.mock('../../query/history', () => ({
  useHistory: () => ({ commits: [] }),
}));
vi.mock('../workspace/preferences', () => ({
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
  cleanup();
  state.evidence = [];
  state.bulkEntries = [];
});

describe('layer review progress', () => {
  it('counts declared missing paths and excludes evidence from other layers', () => {
    state.evidence = [
      evidenceEntry('same.ts', 'reviewed'),
      evidenceEntry('other.ts', 'reviewed', otherLayerChange),
    ];

    renderLayer();

    expect(screen.getByText('1/2')).toBeTruthy();
    expect(
      screen.getByRole('progressbar', { name: '1 of 2 files reviewed' }),
    ).toBeTruthy();
    expect(state.bulkEntries.map((entry) => entry.path)).toEqual(['same.ts']);
    expect(
      screen.getByRole('button', { name: 'Mark layer reviewed' }),
    ).toBeTruthy();
  });

  it('updates the toolbar counter when reviewed evidence changes', () => {
    state.evidence = [
      evidenceEntry('same.ts', 'unreviewed'),
      evidenceEntry('missing.ts', 'unreviewed', unstaged),
    ];
    const view = renderLayer();

    expect(screen.getByText('0/2')).toBeTruthy();
    state.evidence = [
      evidenceEntry('same.ts', 'reviewed'),
      evidenceEntry('missing.ts', 'reviewed', unstaged),
    ];
    view.rerender(
      <DocumentView
        scope={scope}
        document={{ kind: 'layer', layerId: layer.id }}
        onOpen={vi.fn()}
      />,
    );

    expect(screen.getByText('2/2')).toBeTruthy();
  });
});
