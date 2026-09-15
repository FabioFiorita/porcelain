import { ConnectionError } from '@porcelain/client/errors/connection-error';
import type { CommentThread } from '../../domain/comments';
import type { FilePreference } from '../../domain/file-preferences';
import type {
  Inventory,
  ProjectDiscovery,
  ProjectFolder,
} from '../../domain/inventory';
import type { ReviewedMark } from '../../domain/review';
import { createId } from '../../lib/id';
import { reviewFixture } from '../review/fixtures';
import type { InventoryPort } from './port';

export type MockScenario =
  | 'populated'
  | 'empty'
  | 'unavailable'
  | 'slow'
  | 'rejected'
  | 'refresh-failed'
  | 'review-empty'
  | 'review-failed';

const additionalProjects = [
  [
    'Design system',
    'design-system',
    ['main', 'feat/accessible-navigation', 'fix/focus-rings'],
  ],
  [
    'Platform & developer experience',
    'platform',
    [
      'main',
      'agent/streaming-review-events-and-reconnection',
      null,
      'chore/update-dependencies',
    ],
  ],
  ['Documentation', 'docs', ['main', 'docs/worktree-review-guide']],
  [
    'API gateway',
    'api-gateway',
    ['main', 'fix/session-cancellation', 'feat/request-tracing'],
  ],
  ['Archived experiments', 'experiments', ['main', null]],
] as const;

function seed(scenario: MockScenario): Inventory {
  return {
    environmentId: '7fe18f78-1477-4c19-a42b-cdd42f862151',
    projects:
      scenario === 'empty'
        ? []
        : [
            {
              id: 'fac0e50f-b019-4e46-9dd1-efcb6af7dc09',
              name: 'Porcelain',
              available: scenario !== 'unavailable',
              worktrees: [
                {
                  id: '801a8628-1cd6-4562-81a2-9c05fba76b4a',
                  path: '/fixtures/sample-project',
                  branch: 'refs/heads/main',
                  main: true,
                  available: scenario !== 'unavailable',
                },
                {
                  id: '629a8628-1cd6-4562-81a2-9c05fba76b4b',
                  path: '/fixtures/sample-review',
                  branch: 'refs/heads/agent/review',
                  main: false,
                  available: true,
                },
                {
                  id: '629a8628-1cd6-4562-81a2-9c05fba76b4c',
                  path: '/fixtures/porcelain/detached-review',
                  branch: null,
                  main: false,
                  available: true,
                },
                {
                  id: '629a8628-1cd6-4562-81a2-9c05fba76b4d',
                  path: '/fixtures/porcelain/worktrees/archived-prototype',
                  branch: 'refs/heads/archive/initial-prototype',
                  main: false,
                  available: false,
                },
              ],
            },
            ...additionalProjects.map(
              ([name, directory, branches], projectIndex) => ({
                id: `fac0e50f-b019-4e46-9dd1-efcb6af7dc${10 + projectIndex}`,
                name,
                available: projectIndex !== 4,
                worktrees: branches.map((branch, worktreeIndex) => ({
                  id: `801a8628-1cd6-4562-81a2-9c05fba76${projectIndex}${worktreeIndex}a`,
                  path: `/fixtures/${directory}/${worktreeIndex === 0 ? 'repository' : `worktrees/${branch ?? 'detached-review'}`}`,
                  branch: branch === null ? null : `refs/heads/${branch}`,
                  main: worktreeIndex === 0,
                  available: projectIndex !== 4,
                })),
              }),
            ),
          ],
  };
}

export function createMockStore(scenario: MockScenario = 'populated') {
  const inventory = seed(scenario);
  const review = Object.fromEntries(
    inventory.projects.flatMap((project) =>
      project.worktrees.map((worktree) => {
        const fixture = reviewFixture(
          worktree.id,
          inventory.environmentId,
          worktree.branch,
        );
        if (scenario === 'review-empty' || worktree.main) {
          fixture.status.changes = [];
          fixture.layers.layers = [];
          fixture.artifacts = [];
        }
        if (scenario === 'review-empty') {
          fixture.files = {};
          fixture.history.commits = [];
        }
        return [worktree.id, fixture];
      }),
    ),
  );
  const reviewed: Record<string, ReviewedMark[]> = Object.fromEntries(
    inventory.projects.flatMap((project) =>
      project.worktrees.map((worktree) => [worktree.id, [] as ReviewedMark[]]),
    ),
  );
  return {
    sessionToken: '',
    disconnectFailed: false,
    comments: {} as Record<string, CommentThread[]>,
    filePreferences: {} as Record<string, FilePreference[]>,
    filePreferencesFailed: false,
    commentsFailed: false,
    actionCount: 0,
    loseActionResponse: false,
    inventory,
    review,
    reviewed,
    reviewFailed: scenario === 'review-failed',
    changesFailed: false,
    artifactsFailed: false,
    evidenceFailed: false,
    reviewedFailed: false,
    reviewedSetFailed: false,
    reviewedRemoveFailed: false,
    registerFailed: false,
    removeFailed: false,
    discoveryFailed: false,
    projectDiscovery: {
      repositories: [{ name: 'new-project', path: '/srv/work/new-project' }],
      limited: false,
    } as ProjectDiscovery,
    projectFolders: {
      '/srv/work': {
        path: '/srv/work',
        parent: '/srv',
        directories: [{ name: 'new-project', path: '/srv/work/new-project' }],
        repository: false,
        truncated: false,
      },
      '/srv/work/new-project': {
        path: '/srv/work/new-project',
        parent: '/srv/work',
        directories: [],
        repository: true,
        truncated: false,
      },
    } as Record<string, ProjectFolder>,
    delayMs: scenario === 'slow' ? 1500 : 0,
    rejected: scenario === 'rejected',
    refreshFailed: scenario === 'refresh-failed',
    refreshCount: 0,
  };
}

type MockStore = ReturnType<typeof createMockStore>;

async function prepareInventoryRequest(
  store: MockStore,
  token: string,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  if (store.delayMs > 0)
    await new Promise<void>((resolve, reject) => {
      const onAbort = () => {
        clearTimeout(timer);
        reject(signal.reason);
      };
      const timer = setTimeout(() => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      }, store.delayMs);
      signal.addEventListener('abort', onAbort, { once: true });
    });
  signal.throwIfAborted();
  if (
    !token.trim() ||
    store.rejected ||
    (token === 'browser-session' && !store.sessionToken)
  )
    throw new ConnectionError(
      'Access token was rejected. Check it and try again.',
    );
}

export function createInventoryMock(
  store: ReturnType<typeof createMockStore>,
): InventoryPort {
  return {
    async remove({ token, signal, projectId }) {
      await prepareInventoryRequest(store, token, signal);
      if (store.removeFailed)
        throw new ConnectionError(
          'This project has an active or unresolved Git operation. Resolve it before removing the project.',
        );
      const project = store.inventory.projects.find(
        (entry) => entry.id === projectId,
      );
      store.inventory.projects = store.inventory.projects.filter(
        (entry) => entry.id !== projectId,
      );
      return { deleted: Boolean(project) };
    },
    async discover({ token, signal }) {
      await prepareInventoryRequest(store, token, signal);
      if (store.discoveryFailed)
        throw new ConnectionError(
          'Could not discover repositories. Try again.',
        );
      return structuredClone(store.projectDiscovery);
    },
    async browse({ token, signal, path = '/srv/work' }) {
      await prepareInventoryRequest(store, token, signal);
      const folder = store.projectFolders[path];
      if (!folder)
        throw new ConnectionError(
          'That folder could not be read on the Porcelain server.',
        );
      return structuredClone(folder);
    },
    async read({ token, signal, refresh }) {
      await prepareInventoryRequest(store, token, signal);
      if (refresh && store.refreshFailed)
        throw new ConnectionError(
          'The environment could not complete the request. Try again.',
        );
      if (refresh) store.refreshCount += 1;
      if (token !== 'browser-session') store.sessionToken = token;
      return structuredClone(store.inventory);
    },
    async register({ token, signal, path }) {
      await prepareInventoryRequest(store, token, signal);
      if (store.registerFailed)
        throw new ConnectionError(
          'That project could not be opened on the Porcelain server. Check the path and try again.',
        );
      if (token !== 'browser-session') store.sessionToken = token;
      const existing = store.inventory.projects.find((project) =>
        project.worktrees.some((worktree) => worktree.path === path),
      );
      if (existing) return structuredClone(existing);
      const projectId = createId();
      const worktreeId = createId();
      const name = path.split('/').filter(Boolean).at(-1) || 'project';
      const project = {
        id: projectId,
        name,
        available: true,
        worktrees: [
          {
            id: worktreeId,
            path,
            branch: 'refs/heads/main',
            main: true,
            available: true,
          },
        ],
      };
      store.inventory.projects.push(project);
      store.review[worktreeId] = reviewFixture(
        worktreeId,
        store.inventory.environmentId,
        'refs/heads/main',
      );
      return structuredClone(project);
    },
  };
}
