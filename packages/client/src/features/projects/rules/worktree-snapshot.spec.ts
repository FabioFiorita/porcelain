import { expect, it } from 'vite-plus/test';
import {
  emptyNavigatorFilter,
  navigatorRowTitle,
} from './worktree-navigator.ts';
import {
  projectWorktreeSnapshot,
  savedWorktreeRows,
} from './worktree-snapshot.ts';

const app = '30000000-0000-4000-8000-000000000001';
const docs = '30000000-0000-4000-8000-000000000002';
const detached = 'a'.repeat(32);
const topic = 'b'.repeat(32);
const snapshot = projectWorktreeSnapshot(
  {
    environmentId: 'office',
    environment: { name: 'Office', custom: true },
    projects: [
      {
        id: app,
        name: 'App',
        available: true,
        worktrees: [
          {
            id: detached,
            path: '/code/app/release-checkout',
            branch: undefined,
            main: false,
            available: true,
          },
        ],
      },
      {
        id: docs,
        name: 'Docs',
        available: true,
        worktrees: [
          {
            id: topic,
            path: '/code/docs/tmp-123',
            branch: 'topic/pairing',
            walkthroughTitle: 'Document recovery',
            main: false,
            available: true,
          },
        ],
      },
    ],
  },
  '["phone"]',
  10,
);

it('uses the checkout folder name for an untitled detached worktree', () => {
  expect(snapshot.rows.find((row) => row.worktreeId === detached)?.title).toBe(
    'release-checkout',
  );
});

it('matches saved rows across title, computer, branch and path within the chosen scopes', () => {
  const ids = (query: string, filter = emptyNavigatorFilter) =>
    savedWorktreeRows(snapshot, 'office', query, filter).map(
      (row) => row.worktreeId,
    );
  expect(ids(' OFFICE    pairing /code/docs/tmp-123 ')).toEqual([topic]);
  expect(
    ids('release-checkout app', {
      ...emptyNavigatorFilter,
      projects: ['office/' + app],
    }),
  ).toEqual([detached]);
  expect(
    ids('pairing', { ...emptyNavigatorFilter, projects: ['office/' + app] }),
  ).toEqual([]);
  expect(
    ids('release-checkout', {
      ...emptyNavigatorFilter,
      environments: ['home'],
    }),
  ).toEqual([]);
});

it('still shows and searches snapshots written before checkout metadata was saved', () => {
  const rows = savedWorktreeRows(
    {
      version: 1,
      pairing: '["phone"]',
      confirmedAt: 10,
      computerName: 'Office',
      rows: [
        {
          projectId: docs,
          projectName: 'Docs',
          worktreeId: topic,
          title: 'Document recovery',
        },
      ],
    },
    'office',
    'docs recovery',
    emptyNavigatorFilter,
  );
  expect(rows.map(navigatorRowTitle)).toEqual(['Document recovery']);
  expect(rows.map((row) => row.available)).toEqual([false]);
});
