import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, test as base, type Page } from '@playwright/test';
import { pairingLink } from '@porcelain/contracts/access';
import { createServer, type ViteDevServer } from 'vite';
import {
  createFailures,
  failureMessage,
  type Failures,
} from '../kit/failures.ts';
import type { BrowserFailure, ServerName } from '../kit/protocol.ts';
import { serverReaders } from '../kit/readers.ts';
import { agentOn, projectHomeOn, sampleRepository } from '../kit/shapes.ts';
import { World } from '../kit/world.ts';
import { serverBuild } from './global-setup.ts';
import {
  failInventory,
  holdNextPost,
  holdNextReviewRead,
  liveRouter,
} from './network.ts';

export { expect };
export type { Page };

declare const navigation: { entries(): { url: string | null }[] };
declare const location: { href: string };
declare const window: { dispatchEvent(event: Event): boolean };

export type Shell = 'web' | 'desktop';

const webRoot = resolve(import.meta.dirname, '../..');
const repositoryRoot = resolve(webRoot, '../..');
const viteModes: Record<Shell, string> = { web: 'test', desktop: 'desktop' };
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

type WorkerFixtures = { shell: Shell; vite: Vite };

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
    revokeDevice: (id: string, server: ServerName = 'remote') =>
      world.revokeDevice(id, server),
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
    visited: () =>
      page.evaluate(() =>
        navigation
          .entries()
          .map((entry) => new URL(entry.url ?? '', location.href).pathname),
      ),
    async failSessionRestore() {
      const end = await failInventory(page.context());
      return {
        async end() {
          await end();
          await page.evaluate(() => window.dispatchEvent(new Event('online')));
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

type WatchedFailures = Failures & { reported: () => Promise<string[]> };

let running: WatchedFailures | undefined;

export function runningFailures(): WatchedFailures {
  if (running === undefined)
    throw new Error(
      'The automatic failures fixture watches every test; none is running.',
    );
  return running;
}

export type Repo = Awaited<ReturnType<typeof repositoryOf>>;

type TestFixtures = {
  world: World;
  observed: BrowserFailure[];
  live: LiveFixture;
  failures: WatchedFailures;
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
  vite: [
    async ({ shell }, use) => {
      const vite = await startVite(shell);
      await use(vite);
      await vite.close();
    },
    { scope: 'worker' },
  ],
  baseURL: async ({ vite }, use) => {
    await use(vite.url);
  },
  world: async ({ vite }, use, testInfo) => {
    const world = await World.start(repositoryRoot, serverBuild());
    vite.target(world.server.address);
    await use(world);
    await world.keepEvidence(testInfo.outputPath('server'));
    const stopped = await world.stop();
    if (stopped.length > 0)
      throw new Error(
        `The disposable servers did not stop: ${stopped.join('; ')}`,
      );
  },
  observed: async ({ context }, use) => {
    const observed: BrowserFailure[] = [];
    context.on('console', (message) => {
      if (message.type() === 'error' && message.args().length > 0)
        observed.push({ kind: 'console error', message: message.text() });
    });
    context.on('weberror', (failure) =>
      observed.push({
        kind: 'uncaught error',
        message: failure.error().message,
      }),
    );
    await use(observed);
  },
  page: async ({ page, observed: _observed, live: _live }, use) => {
    await use(page);
  },
  live: async ({ context }, use) => {
    const router = await liveRouter(context);
    await use(router);
    router.releaseHeld();
  },
  failures: [
    async ({ world, observed, live: _live }, use, testInfo) => {
      const failures = createFailures();
      const reported = async () =>
        failures.unexpected(observed, [
          ...(await world.hits('this')),
          ...(await world.hits('remote')),
        ]);
      const watched: WatchedFailures = { ...failures, reported };
      running = watched;
      await use(watched);
      running = undefined;
      const unexpected = await reported();
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

export async function keptEvidence(world: World): Promise<string> {
  const folder = await mkdtemp(join(tmpdir(), 'porcelain-e2e-evidence-'));
  await world.keepEvidence(folder);
  const saved = [
    await readFile(join(folder, 'kit.json'), 'utf8'),
    await readFile(join(folder, 'server.json'), 'utf8'),
  ].join('\n');
  await rm(folder, { recursive: true, force: true });
  return saved;
}
