import {
  createMemoryHistory,
  createRouter,
  RouterContextProvider,
  RouterProvider,
} from '@tanstack/react-router';
import { routeTree } from '@/routeTree.gen';
import { pairingLink } from '@porcelain/contracts/access';
import { useElement } from '../../src/shared/hooks/use-element';
import { getHotkeyManager } from '@tanstack/react-hotkeys';
import { SHORTCUTS } from '@/shared/workspace/shortcuts';
import { AtomRegistry } from 'effect/reactivity';
import { Suspense, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, test as base } from 'vitest';
import { page } from 'vitest/browser';
import '@/app.css';
import { AppProviders } from '@/app/app-providers';
import { PairedShell } from '@/app/paired-shell';
import {
  pairBrowser,
  restoreSession,
  accessSession,
  applicationRuntime,
} from '@/features/access/index';
import { ThemeProvider } from '@/features/preferences/index';
import { ProjectNavigator, useInventory } from '@/features/projects/index';
import { ReviewWorkspace } from '@/features/reviews/index';
import type { RemoteConnection } from '@porcelain/client/access';
import type { Connection } from '@/shared/workspace/connection';
import type { WorkspaceSearch } from '@/shared/workspace/search';
import {
  createFailures,
  failureMessage,
  type Failures,
} from '../kit/failures.ts';
import type { BrowserFailure, ServerName } from '../kit/protocol.ts';
import { serverReaders } from '../kit/readers.ts';
import {
  agentOn,
  projectHomeOn,
  sampleRepository,
  type SampleRepository,
} from '../kit/shapes.ts';
import { createPierreCodeView } from './pierre-code-view.ts';
import { refChips } from './ref-chips.ts';
import { reviewLayout } from './review-layout.ts';
import { host } from './commands.ts';
import { createFetchGate, live } from './network.ts';

export { expect };
export { expectInputFocus } from './focus.ts';
export { replaceEditorContent } from './commands.ts';

export type Repo = SampleRepository;
export type { Agent } from '../kit/shapes.ts';
export type Render = {
  workspace: () => Promise<typeof page>;
  route: (
    path: string,
    options?: { unpaired?: boolean },
  ) => Promise<{
    page: typeof page;
    navigate: (path: string) => Promise<void>;
    pair: () => Promise<void>;
    location: () => string;
    pendingDestination: () => string | null;
  }>;
  navigator: (options?: {
    remotes: readonly RemoteConnection[];
  }) => Promise<typeof page>;
};

type WatchedFailures = Failures & { reported: () => Promise<string[]> };

const observed: BrowserFailure[] = [];
let running: WatchedFailures | undefined;
let watching = false;

function describeValue(value: unknown): string {
  if (value instanceof Error) return value.message;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

const resizeObserverNotice =
  'ResizeObserver loop completed with undelivered notifications.';

function observe(failure: BrowserFailure) {
  if (watching && failure.message !== resizeObserverNotice)
    observed.push(failure);
}

const reportError = console.error.bind(console);
console.error = (...values: unknown[]) => {
  observe({
    kind: 'console error',
    message: values.map(describeValue).join(' '),
  });
  reportError(...values);
};
window.addEventListener('error', (event) =>
  observe({
    kind: 'uncaught error',
    message: event.error === null ? event.message : describeValue(event.error),
  }),
);
window.addEventListener('unhandledrejection', (event) =>
  observe({
    kind: 'unhandled rejection',
    message: describeValue(event.reason),
  }),
);

export function runningFailures(): WatchedFailures {
  if (running === undefined)
    throw new Error(
      'The automatic failures fixture watches every test; none is running.',
    );
  return running;
}

function readersOf(server: ServerName) {
  return serverReaders({
    read: (request) => host.porcelainRead({ ...request, server }),
    hits: () => host.porcelainHits(server),
  });
}

function Providers({
  registry,
  children,
}: {
  registry: AtomRegistry.AtomRegistry;
  children: ReactNode;
}) {
  return (
    <AppProviders registry={registry}>
      <ThemeProvider>
        <PairedShell>
          <Suspense>{children}</Suspense>
        </PairedShell>
      </ThemeProvider>
    </AppProviders>
  );
}

function Workspace({ connection }: { connection: Connection }) {
  const inventory = useInventory(connection);
  const [search, setSearch] = useState<WorkspaceSearch>({});
  const trigger = useElement<HTMLButtonElement>();
  const project = inventory.projects[0];
  const worktree = project?.worktrees.find((entry) => entry.main);
  if (project === undefined || worktree === undefined) return null;
  return (
    <div className="flex h-svh min-h-0 flex-col">
      <ReviewWorkspace
        worktree={worktree}
        projectId={project.id}
        context={{ connection }}
        search={search}
        onSearch={(update) =>
          setSearch((previous) => ({ ...previous, ...update }))
        }
        navigationTrigger={trigger}
      />
    </div>
  );
}

function Navigator({
  connection,
  remotes,
}: {
  connection: Connection;
  remotes: readonly RemoteConnection[] | undefined;
}) {
  const inventory = useInventory(connection);
  return (
    <ProjectNavigator
      inventory={inventory}
      remotes={remotes}
      selected={undefined}
      onSelect={() => {}}
      onOpenProject={() => {}}
      onOpenSettings={() => {}}
      onOpenComputers={() => {}}
      onOpenShortcuts={() => {}}
    />
  );
}

async function pairedConnection(
  registry: AtomRegistry.AtomRegistry,
): Promise<Connection> {
  const issued = await host.porcelainPairingLink('Journey browser', 'this');
  await pairBrowser(
    registry,
    { code: issued.code, environmentId: issued.environmentId },
    new AbortController().signal,
  );
  const { connection } = accessSession.state.value;
  if (!(await restoreSession(registry)) || connection === null)
    throw new Error('Pairing left no session the paired routes restore.');
  return connection;
}

async function mount(
  view: (connection: Connection) => ReactNode,
  route?: { path: string; unpaired: boolean },
) {
  const registry = AtomRegistry.make();
  const connection = route?.unpaired
    ? undefined
    : await pairedConnection(registry);
  const router = createRouter({
    routeTree,
    context: { registry },
    history: createMemoryHistory({ initialEntries: [route?.path ?? '/'] }),
    defaultPreload: false,
  });
  const element = document.createElement('div');
  document.body.append(element);
  const root = createRoot(element);
  root.render(
    route ? (
      <AppProviders registry={registry}>
        <RouterProvider router={router} />
      </AppProviders>
    ) : (
      <RouterContextProvider router={router}>
        <Providers registry={registry}>
          {connection && view(connection)}
        </Providers>
      </RouterContextProvider>
    ),
  );
  return {
    router,
    unmount: async () => {
      watching = false;
      root.unmount();
      element.remove();
      await applicationRuntime.runPromise(accessSession.clear());
      registry.dispose();
      localStorage.clear();
      sessionStorage.clear();
      window.history.replaceState(
        window.history.state,
        '',
        window.location.pathname + window.location.search,
      );
    },
  };
}

export const test = base
  .extend('sample', (): 'git-interruption' | undefined => undefined)
  .extend('world', async ({ task, sample }, { onCleanup }) => {
    await host.porcelainStart(sample);
    onCleanup(async () => {
      const stopped = await host.porcelainStop(task.name);
      if (stopped.length > 0)
        throw new Error(
          `The disposable servers did not stop: ${stopped.join('; ')}`,
        );
    });
    return host;
  })
  .extend(
    'failures',
    { auto: true },
    ({ task, world: _world }, { onCleanup }) => {
      observed.length = 0;
      watching = true;
      const failures = createFailures();
      const reported = async () =>
        failures.unexpected([...observed], await host.porcelainHits('this'));
      const watched: WatchedFailures = { ...failures, reported };
      running = watched;
      onCleanup(async () => {
        running = undefined;
        const unexpected = await reported();
        if (unexpected.length > 0)
          throw new Error(failureMessage(task.name, unexpected));
      });
      return watched;
    },
  )
  .extend('tabShortcuts', () => {
    const manager = getHotkeyManager();
    const keys = [
      SHORTCUTS.nextTab,
      SHORTCUTS.previousTab,
      SHORTCUTS.closeTab,
      SHORTCUTS.openToSide,
    ];
    return {
      registered: (selected: readonly string[] = keys) =>
        [...manager.registrations.state.values()]
          .filter((entry) => selected.some((key) => key === entry.hotkey))
          .map((entry) => [entry.hotkey, entry.options.conflictBehavior])
          .toSorted((left, right) =>
            String(left[0]) < String(right[0])
              ? -1
              : String(left[0]) > String(right[0])
                ? 1
                : 0,
          ),
      async registerDuplicate() {
        const close = [...manager.registrations.state.values()].find(
          (entry) => entry.hotkey === SHORTCUTS.closeTab,
        );
        if (!close)
          throw new Error('The workspace did not register its close shortcut');
        manager
          .register(SHORTCUTS.closeTab, () => {}, close.options)
          .unregister();
      },
    };
  })
  .extend('server', ({ world: _world }) => ({
    ...readersOf('this'),
    branchReviewMarks: async () => {
      const published = await readersOf('this').publishedReview();
      const reviewId = published.review?.reviewId;
      if (!reviewId) throw new Error('The fixture has no branch review.');
      return (
        await host.porcelainRead({
          server: 'this',
          target: 'network',
          path: `/api/reviews/${reviewId}/marks`,
        })
      ).body;
    },
    review: async (reviewId: string) =>
      (
        await host.porcelainRead({
          server: 'this',
          target: 'network',
          path: `/api/reviews/${reviewId}`,
        })
      ).body,
    reviewStatus: async (reviewId: string) =>
      (
        await host.porcelainRead({
          server: 'this',
          target: 'network',
          path: `/api/reviews/${reviewId}`,
        })
      ).status,
    reviewMarks: async (reviewId: string) =>
      (
        await host.porcelainRead({
          server: 'this',
          target: 'network',
          path: `/api/reviews/${reviewId}/marks`,
        })
      ).body,
    reviewComments: async (reviewId: string) =>
      (
        await host.porcelainRead({
          server: 'this',
          target: 'network',
          path: `/api/reviews/${reviewId}/comments`,
        })
      ).body,
  }))
  .extend('repo', async ({ world: _world }) =>
    sampleRepository(
      (step) => host.porcelainRepo(step, 'this'),
      await host.porcelainFixture('this'),
    ),
  )
  .extend('agent', ({ world: _world }) =>
    agentOn((step) => host.porcelainRepo(step, 'this')),
  )
  .extend('projectHome', ({ world: _world }) =>
    projectHomeOn((step) => host.porcelainProjectHome(step, 'this')),
  )
  .extend('codingTool', ({ world: _world }) => ({
    install: () => host.porcelainCodingTool(),
  }))
  .extend('render', async ({ world: _world }, { onCleanup }) => {
    let unmount: (() => Promise<void>) | undefined;
    onCleanup(() => unmount?.());
    const show = async (view: (connection: Connection) => ReactNode) => {
      if (unmount !== undefined)
        throw new Error('A test renders one feature once.');
      const mounted = await mount(view);
      unmount = mounted.unmount;
    };
    const render: Render = {
      async route(path, options) {
        if (unmount !== undefined)
          throw new Error('A test renders one feature once.');
        const mounted = await mount(() => null, {
          path,
          unpaired: options?.unpaired === true,
        });
        unmount = mounted.unmount;
        await mounted.router.load();
        return {
          page,
          navigate: async (path) => {
            mounted.router.history.push(path);
            await mounted.router.load();
          },
          pair: async () => {
            const grant = await host.porcelainPairingLink(
              'Durable review reader',
              'this',
            );
            const fragment = new URL(
              pairingLink({
                addresses: [''],
                code: grant.code,
                environmentId: grant.environmentId,
              }),
              window.location.origin,
            ).hash;
            window.history.replaceState(
              window.history.state,
              '',
              window.location.pathname + window.location.search + fragment,
            );
            await mounted.router.invalidate({ sync: true });
          },
          location: () => mounted.router.state.location.href,
          pendingDestination: () =>
            sessionStorage.getItem('porcelain.pairing.destination'),
        };
      },
      async workspace() {
        await show((connection) => <Workspace connection={connection} />);
        await expect
          .element(
            page.getByRole('region', { name: 'Review content', exact: true }),
          )
          .toBeVisible();
        return page;
      },
      async navigator(options) {
        await show((connection) => (
          <Navigator connection={connection} remotes={options?.remotes} />
        ));
        await expect
          .element(
            page.getByRole('navigation', {
              name: 'Projects and worktrees',
              exact: true,
            }),
          )
          .toBeVisible();
        return page;
      },
    };
    return render;
  })
  .extend('workspace', async ({ render, repo }) => {
    const workspace = await render.workspace();
    await expect
      .element(
        workspace.getByRole('button', {
          name: `Mark ${repo.readme.path} as reviewed`,
          exact: true,
        }),
      )
      .toBeVisible();
    return workspace;
  })
  .extend('navigator', ({ render }) => render.navigator())
  .extend('pierreCodeView', ({ world: _world }, { onCleanup }) => {
    const viewer = createPierreCodeView();
    onCleanup(() => viewer.dispose());
    return viewer;
  })
  .extend('refChips', () => refChips)
  .extend('reviewLayout', () => reviewLayout)
  .extend('fetchGate', ({ repo }, { onCleanup }) => {
    const gate = createFetchGate(repo.readme.path);
    onCleanup(() => gate.restore());
    return gate;
  })
  .extend('live', ({ world: _world }, { onCleanup }) => {
    onCleanup(() => live.restore());
    return live;
  });

export const gitInterruptionTest = test.extend('sample', () =>
  'git-interruption' as const);
