import { describe, expect, it } from 'vite-plus/test';
import {
  emptyNavigatorFilter,
  navigatorEntryMatches,
  navigatorEntryLabel,
  navigatorDisplayTitle,
  navigatorRowTitle,
  navigatorRowTrailing,
  navigatorVisibleRows,
  navigatorCardChangesLabel,
  navigatorChecksLabel,
  type NavigatorChanges,
  type NavigatorPullRequest,
  navigatorFilterSections,
  navigatorEntrySelected,
  nameEnd,
  navigatorWorktreeOrder,
  type NavigatorEntry,
} from './worktree-navigator.ts';

const entry: NavigatorEntry = {
  key: 'desk/project/topic',
  kind: 'worktree',
  environmentId: 'desk',
  environmentName: 'Desk computer',
  projectId: 'project',
  projectName: 'Porcelain',
  worktreeId: 'topic',
  path: '/worktrees/long-detached-folder',
  name: 'long-detached-folder',
  branch: 'Detached HEAD',
  main: false,
  detached: true,
  available: true,
  pullRequest: { state: 'available', number: 42, merged: false },
  changes: { state: 'loading' },
};
it.each<{ changes: NavigatorChanges; label: string }>([
  { changes: { state: 'loading' }, label: '' },
  { changes: { state: 'unavailable' }, label: '—' },
  { changes: { state: 'available', count: 0 }, label: '' },
  { changes: { state: 'available', count: 1 }, label: '1 uncommitted' },
  { changes: { state: 'available', count: 3 }, label: '3 uncommitted' },
])('shows a quiet uncommitted file count: $label', ({ changes, label }) => {
  expect(navigatorCardChangesLabel(changes)).toBe(label);
});

it.each<{
  checks: Extract<NavigatorPullRequest, { state: 'available' }>['checks'];
  label: string;
}>([
  { checks: undefined, label: 'Checks loading' },
  { checks: { state: 'loading' }, label: 'Checks loading' },
  { checks: { state: 'unavailable' }, label: 'Checks unavailable' },
  { checks: { state: 'available', result: 'passed' }, label: 'Checks passed' },
  {
    checks: { state: 'available', result: 'running' },
    label: 'Checks running',
  },
  { checks: { state: 'available', result: 'failed' }, label: 'Checks failed' },
  { checks: { state: 'available', result: 'none' }, label: 'No checks' },
])('keeps PR check status accessible in words: $label', ({ checks, label }) => {
  expect(navigatorChecksLabel(checks)).toBe(label);
});
it('combines every search term including project, environment, path and PR number', () => {
  expect(navigatorEntryMatches(entry, 'PORCELAIN desk detached 42')).toBe(true);
  expect(navigatorEntryMatches(entry, 'Porcelain another-computer')).toBe(
    false,
  );
});
it('keeps selected checkout identity scoped to its computer', () => {
  expect(
    navigatorEntrySelected(entry, {
      kind: 'worktree',
      environmentId: 'desk',
      worktreeId: 'topic',
    }),
  ).toBe(true);
  expect(
    navigatorEntrySelected(entry, {
      kind: 'worktree',
      environmentId: 'other',
      worktreeId: 'topic',
    }),
  ).toBe(false);
});

it('names a row by its Walkthrough, else its pull request, else its branch or folder', () => {
  expect(
    navigatorDisplayTitle({
      branch: 'topic',
      walkthroughTitle: 'Explain the sync engine',
      pullRequestTitle: 'Add sync',
    }),
  ).toBe('Explain the sync engine');
  expect(
    navigatorDisplayTitle({ branch: 'topic', pullRequestTitle: 'Add sync' }),
  ).toBe('Add sync');
  expect(navigatorDisplayTitle({ branch: 'topic' })).toBeUndefined();
  expect(
    navigatorDisplayTitle({ branch: 'topic', pullRequestTitle: 'topic' }),
  ).toBeUndefined();
  expect(navigatorRowTitle({ displayTitle: 'Add sync', name: 'topic' })).toBe(
    'Add sync',
  );
  expect(navigatorRowTitle({ name: 'topic' })).toBe('topic');
});

it.each<{
  pullRequest: NavigatorPullRequest;
  changes: NavigatorChanges;
  text: string | undefined;
}>([
  {
    pullRequest: { state: 'available', number: 771, merged: false },
    changes: { state: 'available', count: 3 },
    text: '#771',
  },
  {
    pullRequest: { state: 'available', number: 770, merged: true },
    changes: { state: 'available', count: 0 },
    text: '#770',
  },
  {
    pullRequest: { state: 'none' },
    changes: { state: 'available', count: 1 },
    text: '1 file',
  },
  {
    pullRequest: { state: 'unavailable' },
    changes: { state: 'available', count: 4 },
    text: '4 files',
  },
  {
    pullRequest: { state: 'none' },
    changes: { state: 'available', count: 0 },
    text: undefined,
  },
  {
    pullRequest: { state: 'loading' },
    changes: { state: 'unavailable' },
    text: undefined,
  },
])('ends a row with one value: $text', ({ pullRequest, changes, text }) => {
  expect(navigatorRowTrailing({ pullRequest, changes })?.text).toBe(text);
});

it('marks a merged pull request apart from its number so the branch keeps the room', () => {
  expect(
    navigatorRowTrailing({
      pullRequest: { state: 'available', number: 770, merged: true },
      changes: { state: 'available', count: 0 },
    }),
  ).toEqual({ kind: 'pull-request', number: 770, merged: true, text: '#770' });
});

it('keeps the branch, place and state in the accessible name while the row shows only its title', () => {
  expect(navigatorEntryLabel(entry)).toBe(
    'long-detached-folder, Detached HEAD, Porcelain, Desk computer, /worktrees/long-detached-folder, Pull request #42',
  );
  expect(
    navigatorEntryLabel({
      ...entry,
      displayTitle: 'Add sync',
      branch: 'topic',
      detached: false,
      main: true,
      pullRequest: { state: 'available', number: 770, merged: true },
      changes: { state: 'available', count: 2 },
    }),
  ).toBe(
    'Add sync, topic, Porcelain, Desk computer, Main worktree, 2 uncommitted files, Pull request #770 merged',
  );
});

describe('rows shown for an expanded project', () => {
  const rows = ['main', 'a', 'b', 'c', 'd', 'e', 'f', 'g'].map((name) => ({
    key: name,
    main: name === 'main',
  }));
  const keys = (shown: { rows: readonly { key: string }[] }) =>
    shown.rows.map((row) => row.key);

  it('shows main and the five most recently touched, offering the rest', () => {
    const shown = navigatorVisibleRows(rows, {
      selectedKey: 'b',
      showAll: false,
      searching: false,
    });
    expect(keys(shown)).toEqual(['main', 'a', 'b', 'c', 'd', 'e']);
    expect(shown).toMatchObject({ more: 2, less: false });
  });

  it('keeps an older selected worktree below them', () => {
    const shown = navigatorVisibleRows(rows, {
      selectedKey: 'g',
      showAll: false,
      searching: false,
    });
    expect(keys(shown)).toEqual(['main', 'a', 'b', 'c', 'd', 'e', 'g']);
    expect(shown).toMatchObject({ more: 1, less: false });
  });

  it('shows every row once asked, offering to show less', () => {
    const shown = navigatorVisibleRows(rows, {
      selectedKey: undefined,
      showAll: true,
      searching: false,
    });
    expect(keys(shown)).toEqual(rows.map((row) => row.key));
    expect(shown).toMatchObject({ more: 0, less: true });
  });

  it.each([false, true])(
    'shows every match while searching, without offering to show less (show all: %s)',
    (showAll) => {
      const shown = navigatorVisibleRows(rows, {
        selectedKey: undefined,
        showAll,
        searching: true,
      });
      expect(keys(shown)).toEqual(rows.map((row) => row.key));
      expect(shown).toMatchObject({ more: 0, less: false });
    },
  );

  it('offers nothing when every row already fits', () => {
    const few = rows.slice(0, 6);
    expect(
      navigatorVisibleRows(few, {
        selectedKey: undefined,
        showAll: false,
        searching: false,
      }),
    ).toMatchObject({ more: 0, less: false });
    expect(
      navigatorVisibleRows(few, {
        selectedKey: undefined,
        showAll: true,
        searching: false,
      }),
    ).toMatchObject({ more: 0, less: false });
  });
});

it('offers both same-named projects as scoped choices and keeps an empty review selection distinct from all choices', () => {
  const projects = [
    {
      key: 'desk/project',
      name: 'Porcelain',
      environmentId: 'desk',
      environmentName: 'Desk',
      environmentIcon: 'desktop' as const,
    },
    {
      key: 'laptop/project',
      name: 'Porcelain',
      environmentId: 'laptop',
      environmentName: 'Laptop',
      environmentIcon: 'laptop' as const,
    },
  ];
  const sections = navigatorFilterSections(projects, {
    ...emptyNavigatorFilter,
    projects: ['laptop/project'],
  });
  expect(sections.find((section) => section.key === 'projects')?.items).toEqual(
    [
      {
        id: 'desk/project',
        label: 'Porcelain · Desk',
        checked: false,
        next: ['laptop/project', 'desk/project'],
      },
      {
        id: 'laptop/project',
        label: 'Porcelain · Laptop',
        checked: true,
        next: [],
      },
    ],
  );
  expect(
    sections.find((section) => section.key === 'environments')?.items,
  ).toEqual([
    {
      id: 'desk',
      label: 'Desk',
      icon: 'desktop',
      checked: true,
      next: ['laptop'],
    },
    {
      id: 'laptop',
      label: 'Laptop',
      icon: 'laptop',
      checked: true,
      next: ['desk'],
    },
  ]);
});

it('keeps the main worktree first, then the most recently touched by commit or uncommitted change, with undated worktrees last by name', () => {
  const worktree = (
    name: string,
    times: { headCommittedAt?: string; uncommittedChangedAt?: string } = {},
    main = false,
  ) => ({ key: `desk/project/${name}`, name, main, ...times });
  expect(
    [
      worktree('unborn'),
      worktree('older', { headCommittedAt: '2026-10-01T09:00:00.000Z' }),
      worktree('beta', { headCommittedAt: '2026-10-30T12:00:00.000Z' }),
      worktree('main', { headCommittedAt: '2026-01-01T00:00:00.000Z' }, true),
      worktree('alpha', { headCommittedAt: '2026-10-30T12:00:00.000Z' }),
      worktree('newest', { headCommittedAt: '2026-10-31T08:00:00.000Z' }),
      worktree('editing', {
        headCommittedAt: '2026-09-01T00:00:00.000Z',
        uncommittedChangedAt: '2026-11-01T10:00:00.000Z',
      }),
      worktree('edited-earlier', {
        headCommittedAt: '2026-10-31T09:00:00.000Z',
        uncommittedChangedAt: '2026-10-02T10:00:00.000Z',
      }),
      worktree('catalog-only'),
    ]
      .sort(navigatorWorktreeOrder)
      .map((entry) => entry.name),
  ).toEqual([
    'main',
    'editing',
    'edited-earlier',
    'newest',
    'alpha',
    'beta',
    'older',
    'catalog-only',
    'unborn',
  ]);
});

it.each([
  ['fix/interview-engine-persistence', '-persistence'],
  ['feature/note-search', '/note-search'],
  ['chore/update-docs', '/update-docs'],
  ['main', 'main'],
  ['averyveryverylongbranchname', 'rylongbranchname'],
])('keeps the distinguishing end of %s', (name, end) => {
  expect(nameEnd(name)).toBe(end);
  expect(name.endsWith(end)).toBe(true);
});
