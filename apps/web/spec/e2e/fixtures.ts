import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  expect,
  test as base,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import { pairingLink } from '@porcelain/contracts/access';
import { buildIsolatedServer } from '@porcelain/server/kit/sandbox';
import { createServer, type ViteDevServer } from 'vite';
import { z } from 'zod';
import { createFailures, failureMessage } from '../kit/failures.ts';
import type { BrowserFailure, ServerName } from '../kit/protocol.ts';
import { serverReaders } from '../kit/readers.ts';
import { agentOn, projectHomeOn, sampleRepository } from '../kit/shapes.ts';
import { World } from '../kit/world.ts';
import {
  failInventory,
  holdNextPost,
  holdNextReviewRead,
  liveRouter,
} from './network.ts';

export { expect };

export type Shell = 'web' | 'desktop';

const webRoot = resolve(import.meta.dirname, '../..');
const repositoryRoot = resolve(webRoot, '../..');
const viteModes: Record<Shell, string> = { web: 'test', desktop: 'desktop' };
const failureBinding = 'porcelainKitFailure';

const watchPage = `
(() => {
  const describe = (value) =>
    value instanceof Error
      ? value.message
      : typeof value === 'string'
        ? value
        : JSON.stringify(value);
  const report = (kind, value) => {
    const send = window[${JSON.stringify(failureBinding)}];
    if (typeof send === 'function') void send(kind, describe(value));
  };
  const original = console.error.bind(console);
  console.error = (...values) => {
    report('console error', values.map(describe).join(' '));
    original(...values);
  };
  window.addEventListener('error', (event) => report('uncaught error', event.error));
  window.addEventListener('unhandledrejection', (event) =>
    report('unhandled rejection', event.reason),
  );
})();
`;

function isFailureKind(kind: string): kind is BrowserFailure['kind'] {
  return (
    kind === 'console error' ||
    kind === 'uncaught error' ||
    kind === 'unhandled rejection'
  );
}

export async function watchFailures(context: BrowserContext) {
  const observed: BrowserFailure[] = [];
  await context.exposeBinding(
    failureBinding,
    (_source, kind: string, message: string) => {
      if (isFailureKind(kind)) observed.push({ kind, message });
    },
  );
  await context.addInitScript(watchPage);
  return observed;
}

const appSource = '/src/';

async function transformApp(
  client: ViteDevServer['environments']['client'],
  url = `${appSource}main.tsx`,
  seen = new Set<string>(),
): Promise<void> {
  if (seen.has(url)) return;
  seen.add(url);
  await client.warmupRequest(url);
  const module = await client.moduleGraph.getModuleByUrl(url);
  if (module === undefined || module.type === 'css') return;
  await Promise.all(
    [...module.importedModules]
      .filter((imported) => imported.url.startsWith(appSource))
      .map((imported) => transformApp(client, imported.url, seen)),
  );
}

async function startVite(shell: Shell) {
  let target = 'http://127.0.0.1';
  const retarget: Array<(address: string) => void> = [];
  const vite: ViteDevServer = await createServer({
    configFile: join(webRoot, 'vite.config.ts'),
    root: webRoot,
    mode: viteModes[shell],
    logLevel: 'error',
    clearScreen: false,
    server: {
      host: '127.0.0.1',
      port: 0,
      strictPort: false,
      proxy: {
        '^/(api|review-summaries)(/|$)': {
          target,
          ws: true,
          configure(_proxy, options) {
            options.target = target;
            retarget.push((address) => {
              options.target = address;
            });
          },
        },
      },
    },
  });
  await vite.listen();
  await transformApp(vite.environments.client);
  const url = vite.resolvedUrls?.local[0];
  if (url === undefined) throw new Error('Vite printed no local address.');
  return {
    url,
    target(address: string) {
      target = address;
      for (const change of retarget) change(address);
    },
    close: () => vite.close(),
  };
}

type Vite = Awaited<ReturnType<typeof startVite>>;

type WorkerFixtures = { shell: Shell; build: string; vite: Vite };

function readersOf(world: World, server: ServerName) {
  return serverReaders({
    read: (request) => world.read({ ...request, server }),
    hits: () => world.hits(server),
  });
}

async function repositoryOf(world: World, server: ServerName) {
  return sampleRepository(
    (step) => world.repo(step, server),
    await world.fixture(server),
  );
}

function agentOf(world: World, server: ServerName) {
  return agentOn((step) => world.repo(step, server));
}

function projectHomeOf(world: World, server: ServerName) {
  return projectHomeOn((step) => world.projectHome(step, server));
}

async function appOf(page: Page, world: World, live: LiveFixture) {
  return {
    async link(installation: 'this' | 'another') {
      const issued = await world.pairingLink('Journey browser', 'this');
      return pairingLink({
        addresses: [''],
        code: issued.code,
        environmentId:
          installation === 'this' ? issued.environmentId : crypto.randomUUID(),
      });
    },
    async remoteLink(
      server: ServerName = 'remote',
      options: { trusted?: boolean } = {},
    ) {
      const issued = await world.pairingLink(
        'Remote computer',
        server,
        options.trusted ?? false,
      );
      return pairingLink({
        addresses: [issued.address],
        code: issued.code,
        environmentId: issued.environmentId,
      });
    },
    async open(address: string) {
      await page.goto(address);
      return page;
    },
    async reload() {
      await page.reload();
    },
    address() {
      const url = new URL(page.url());
      return { path: url.pathname, query: url.search, fragment: url.hash };
    },
    title: () => page.title(),
    async follow(address: string) {
      await page.goto(address);
    },
    visited: async () =>
      z
        .array(z.string())
        .parse(
          await page.evaluate(
            "navigation.entries().map((entry) => new URL(entry.url ?? '', location.href).pathname)",
          ),
        ),
    async failSessionRestore() {
      const end = await failInventory(page.context());
      return {
        async end() {
          await end();
          await page.evaluate("window.dispatchEvent(new Event('online'))");
        },
      };
    },
    holdLive: () => live.hold(),
    summary: () =>
      page
        .getByRole('region', { name: 'Published review', exact: true })
        .getByTitle('Review summary', { exact: true })
        .contentFrame(),
  };
}

type LiveFixture = Awaited<ReturnType<typeof liveRouter>>;

export type Repo = Awaited<ReturnType<typeof repositoryOf>>;

type TestFixtures = {
  world: World;
  observed: BrowserFailure[];
  live: LiveFixture;
  failures: ReturnType<typeof createFailures>;
  server: ReturnType<typeof readersOf>;
  repo: Awaited<ReturnType<typeof repositoryOf>>;
  agent: ReturnType<typeof agentOf>;
  projectHome: ReturnType<typeof projectHomeOf>;
  codingTool: { install: () => ReturnType<World['codingTool']> };
  remote: {
    server: ReturnType<typeof readersOf>;
    repo: Awaited<ReturnType<typeof repositoryOf>>;
    agent: ReturnType<typeof agentOf>;
    projectHome: ReturnType<typeof projectHomeOf>;
  };
  fetchGate: {
    holdNextChangeDiff: () => ReturnType<LiveFixture['holdNextChangeDiff']>;
    holdNextReviewRead: () => ReturnType<typeof holdNextReviewRead>;
    holdNextPost: (ending: string) => ReturnType<typeof holdNextPost>;
  };
  app: Awaited<ReturnType<typeof appOf>>;
  pairedPage: Page;
  unpairedPage: Page;
};

export const test = base.extend<TestFixtures, WorkerFixtures>({
  shell: ['web', { scope: 'worker', option: true }],
  build: [
    async ({}, use) => {
      const folder = await mkdtemp(join(tmpdir(), 'porcelain-e2e-server-'));
      try {
        await buildIsolatedServer(folder);
        await use(folder);
      } finally {
        await rm(folder, { recursive: true, force: true });
      }
    },
    { scope: 'worker' },
  ],
  vite: [
    async ({ shell }, use) => {
      const vite = await startVite(shell);
      try {
        await use(vite);
      } finally {
        await vite.close();
      }
    },
    { scope: 'worker' },
  ],
  baseURL: async ({ vite }, use) => {
    await use(vite.url);
  },
  world: async ({ build, vite }, use, testInfo) => {
    const world = await World.start(repositoryRoot, build);
    vite.target(world.server.address);
    try {
      await use(world);
    } finally {
      await world.keepEvidence(testInfo.outputPath('server'));
      const stopped = await world.stop();
      if (stopped.length > 0)
        throw new Error(
          `The disposable servers did not stop: ${stopped.join('; ')}`,
        );
    }
  },
  observed: async ({ context }, use) => {
    await use(await watchFailures(context));
  },
  page: async ({ page, observed: _observed, live: _live }, use) => {
    await use(page);
  },
  live: async ({ context }, use) => {
    const router = await liveRouter(context);
    try {
      await use(router);
    } finally {
      router.releaseHeld();
    }
  },
  failures: [
    async ({ world, observed, live: _live }, use, testInfo) => {
      const failures = createFailures();
      await use(failures);
      const hits = [
        ...(await world.hits('this')),
        ...(await world.hits('remote')),
      ];
      const unexpected = failures.unexpected(observed, hits);
      if (unexpected.length > 0)
        throw new Error(failureMessage(testInfo.title, unexpected));
    },
    { auto: true },
  ],
  server: async ({ world }, use) => {
    await use(readersOf(world, 'this'));
  },
  repo: async ({ world }, use) => {
    await use(await repositoryOf(world, 'this'));
  },
  agent: async ({ world }, use) => {
    await use(agentOf(world, 'this'));
  },
  projectHome: async ({ world }, use) => {
    await use(projectHomeOf(world, 'this'));
  },
  codingTool: async ({ world }, use) => {
    await use({ install: () => world.codingTool() });
  },
  remote: async ({ world }, use) => {
    await use({
      server: readersOf(world, 'remote'),
      repo: await repositoryOf(world, 'remote'),
      agent: agentOf(world, 'remote'),
      projectHome: projectHomeOf(world, 'remote'),
    });
  },
  fetchGate: async ({ context, live, repo }, use) => {
    await use({
      holdNextChangeDiff: () => live.holdNextChangeDiff(repo.readme.path),
      holdNextReviewRead: () => holdNextReviewRead(context),
      holdNextPost: (ending) => holdNextPost(context, ending),
    });
  },
  app: async ({ page, world, live }, use) => {
    await use(await appOf(page, world, live));
  },
  pairedPage: async ({ app, page }, use) => {
    await app.open(await app.link('this'));
    await expect(
      page.getByRole('region', { name: 'Review content', exact: true }),
    ).toBeVisible();
    await use(page);
  },
  unpairedPage: async ({ app, page }, use) => {
    await app.open('/');
    await use(page);
  },
});
