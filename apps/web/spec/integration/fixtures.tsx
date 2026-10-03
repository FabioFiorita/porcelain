import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { Suspense, useRef, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, test as base } from 'vitest';
import { page } from 'vitest/browser';
import '@/app.css';
import { AppProviders } from '@/app/app-providers';
import { PairedShell } from '@/app/paired-shell';
import {
  pairBrowser,
  restoreSession,
  useAccessStore,
} from '@/features/access/index';
import { ThemeProvider } from '@/features/preferences/index';
import { ProjectNavigator, useInventory } from '@/features/projects/index';
import { ReviewWorkspace } from '@/features/reviews/index';
import { createQueryClient } from '@/shared/query/client';
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
import { host } from './commands.ts';
import { createFetchGate, live } from './network.ts';

export { expect };

export type Repo = SampleRepository;
export type { Agent } from '../kit/shapes.ts';
export type Render = {
  workspace: () => Promise<typeof page>;
  navigator: () => Promise<typeof page>;
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
  client,
  children,
}: {
  client: QueryClient;
  children: ReactNode;
}) {
  return (
    <AppProviders
      query={(app) => (
        <QueryClientProvider client={client}>{app}</QueryClientProvider>
      )}
    >
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
  const trigger = useRef<HTMLButtonElement>(null);
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

function Navigator({ connection }: { connection: Connection }) {
  const inventory = useInventory(connection);
  return (
    <ProjectNavigator
      inventory={inventory}
      connection={connection}
      remotes={undefined}
      selected={undefined}
      onSelect={() => {}}
      onOpenProject={() => {}}
      onOpenSettings={() => {}}
      onOpenRemotes={() => {}}
      onOpenShortcuts={() => {}}
    />
  );
}

async function pairedConnection(client: QueryClient): Promise<Connection> {
  const issued = await host.porcelainPairingLink('Journey browser', 'this');
  await pairBrowser(
    client,
    { code: issued.code, environmentId: issued.environmentId },
    new AbortController().signal,
  );
  const { connection } = useAccessStore.getState();
  if (!(await restoreSession(client)) || connection === null)
    throw new Error('Pairing left no session the paired routes restore.');
  return connection;
}

async function mount(view: (connection: Connection) => ReactNode) {
  const client = createQueryClient();
  const connection = await pairedConnection(client);
  const element = document.createElement('div');
  document.body.append(element);
  const root = createRoot(element);
  root.render(<Providers client={client}>{view(connection)}</Providers>);
  return () => {
    watching = false;
    root.unmount();
    element.remove();
    useAccessStore.getState().clear();
    client.clear();
    localStorage.clear();
    sessionStorage.clear();
  };
}

export const test = base
  .extend('world', async ({ task }, { onCleanup }) => {
    await host.porcelainStart();
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
  .extend('server', ({ world: _world }) => readersOf('this'))
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
    let unmount: (() => void) | undefined;
    onCleanup(() => unmount?.());
    const show = async (view: (connection: Connection) => ReactNode) => {
      if (unmount !== undefined)
        throw new Error('A test renders one feature once.');
      unmount = await mount(view);
    };
    const render: Render = {
      async workspace() {
        await show((connection) => <Workspace connection={connection} />);
        await expect
          .element(
            page.getByRole('region', { name: 'Review content', exact: true }),
          )
          .toBeVisible();
        return page;
      },
      async navigator() {
        await show((connection) => <Navigator connection={connection} />);
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
  .extend('workspace', ({ render }) => render.workspace())
  .extend('navigator', ({ render }) => render.navigator())
  .extend('fetchGate', ({ repo }, { onCleanup }) => {
    const gate = createFetchGate(repo.readme.path);
    onCleanup(() => gate.restore());
    return gate;
  })
  .extend('live', ({ world: _world }, { onCleanup }) => {
    onCleanup(() => live.restore());
    return live;
  });
