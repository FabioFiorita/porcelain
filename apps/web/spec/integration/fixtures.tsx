import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { StrictMode, Suspense, useRef, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, test as base } from 'vitest';
import { page } from 'vitest/browser';
import '@/app.css';
import { ReviewShell } from '@/app/review-shell';
import { WorkspaceProvider } from '@/app/workspace-provider';
import { toast, Toaster } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';
import { pairBrowser, useAccessStore } from '@/features/access/index';
import { ThemeProvider } from '@/features/preferences/index';
import {
  ProjectNavigator,
  ProjectWorkspaceProvider,
  useInventory,
} from '@/features/projects/index';
import { ReviewWorkspace } from '@/features/reviews/index';
import { createQueryClient } from '@/shared/query/client';
import { onCopyNotice } from '@/shared/workspace/copy';
import type { Connection } from '@/shared/workspace/connection';
import type { WorkspaceSearch } from '@/shared/workspace/search';
import { createFailures, failureMessage } from '../kit/failures.ts';
import type { BrowserFailure, ServerName } from '../kit/protocol.ts';
import { serverReaders } from '../kit/readers.ts';
import { agentOn, projectHomeOn, sampleRepository } from '../kit/shapes.ts';
import { host } from './commands.ts';

export { expect };

const observed: BrowserFailure[] = [];

function describeValue(value: unknown): string {
  if (value instanceof Error) return value.message;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

const reportError = console.error.bind(console);
console.error = (...values: unknown[]) => {
  observed.push({
    kind: 'console error',
    message: values.map(describeValue).join(' '),
  });
  reportError(...values);
};
window.addEventListener('error', (event) =>
  observed.push({ kind: 'uncaught error', message: describeValue(event.error) }),
);
window.addEventListener('unhandledrejection', (event) =>
  observed.push({
    kind: 'unhandled rejection',
    message: describeValue(event.reason),
  }),
);
onCopyNotice((notice) => toast.add(notice));

export function takeObserved(): BrowserFailure[] {
  return observed.splice(0);
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
    <StrictMode>
      <TooltipProvider>
        <QueryClientProvider client={client}>
          <WorkspaceProvider>
            <Toaster>
              <ThemeProvider>
                <ReviewShell>
                  <ProjectWorkspaceProvider open onOpenChange={() => {}}>
                    <Suspense>{children}</Suspense>
                  </ProjectWorkspaceProvider>
                </ReviewShell>
              </ThemeProvider>
            </Toaster>
          </WorkspaceProvider>
        </QueryClientProvider>
      </TooltipProvider>
    </StrictMode>
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
  if (connection === null) throw new Error('Pairing left no connection.');
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
      takeObserved();
      const failures = createFailures();
      onCleanup(async () => {
        const hits = await host.porcelainHits('this');
        const unexpected = failures.unexpected(takeObserved(), hits);
        if (unexpected.length > 0)
          throw new Error(failureMessage(task.name, unexpected));
      });
      return failures;
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
  .extend('workspace', async ({ world: _world }, { onCleanup }) => {
    onCleanup(await mount((connection) => <Workspace connection={connection} />));
    await expect
      .element(page.getByRole('region', { name: 'Review content', exact: true }))
      .toBeVisible();
    return page;
  })
  .extend('navigator', async ({ world: _world }, { onCleanup }) => {
    onCleanup(await mount((connection) => <Navigator connection={connection} />));
    await expect
      .element(
        page.getByRole('navigation', {
          name: 'Projects and worktrees',
          exact: true,
        }),
      )
      .toBeVisible();
    return page;
  });
