import { rmSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { buildIsolatedServer } from '@porcelain/server/kit/sandbox';
import type { BrowserCommand } from 'vitest/node';
import type {
  CodingToolReplies,
  PairingParts,
  ProjectHomeStep,
  RepoFixture,
  RepoStep,
  ServerAnswer,
  ServerHit,
  ServerName,
  ServerRead,
} from '../kit/protocol.ts';
import { World } from '../kit/world.ts';

const webRoot = resolve(import.meta.dirname, '../..');
const repositoryRoot = resolve(webRoot, '../..');
const evidenceRoot = join(webRoot, 'test-results', 'integration');
let build: Promise<string> | undefined;
let current: World | undefined;
let target = 'http://127.0.0.1';
const retarget: Array<(address: string) => void> = [];

function serverBuild(): Promise<string> {
  build ??= mkdtemp(join(tmpdir(), 'porcelain-integration-server-')).then(
    async (folder) => {
      process.once('exit', () =>
        rmSync(folder, { recursive: true, force: true }),
      );
      await buildIsolatedServer(folder);
      return folder;
    },
  );
  return build;
}

function world(): World {
  if (current === undefined)
    throw new Error(
      'The integration fixtures start a disposable server before a test reaches it.',
    );
  return current;
}

export const proxy = {
  '^/(api|review-summaries)(/|$)': {
    target,
    ws: true,
    configure(_proxy: unknown, options: { target?: unknown }) {
      options.target = target;
      retarget.push((address) => {
        options.target = address;
      });
    },
  },
};

const porcelainStart: BrowserCommand<[], void> = async () => {
  if (current !== undefined) await current.stop();
  current = await World.start(repositoryRoot, await serverBuild());
  target = current.server.address;
  for (const change of retarget) change(target);
};

const porcelainStop: BrowserCommand<[string], string[]> = async (
  _context,
  name,
) => {
  const stopping = world();
  current = undefined;
  await stopping.keepEvidence(
    join(evidenceRoot, name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()),
  );
  return stopping.stop();
};

const porcelainRead: BrowserCommand<[ServerRead], ServerAnswer> = (
  _context,
  request,
) => world().read(request);

const porcelainRepo: BrowserCommand<[RepoStep, ServerName], string> = (
  _context,
  step,
  server,
) => world().repo(step, server);

const porcelainFixture: BrowserCommand<[ServerName], RepoFixture> = (
  _context,
  server,
) => world().fixture(server);

const porcelainPairingLink: BrowserCommand<
  [string, ServerName, boolean?],
  PairingParts
> = (_context, label, server, trusted) =>
  world().pairingLink(label, server, trusted);

const porcelainHits: BrowserCommand<[ServerName], ServerHit[]> = (
  _context,
  server,
) => world().hits(server);

const porcelainProjectHome: BrowserCommand<
  [ProjectHomeStep, ServerName],
  string
> = (_context, step, server) => world().projectHome(step, server);

const porcelainCodingTool: BrowserCommand<[], CodingToolReplies> = () =>
  world().codingTool();

export const hostCommands = {
  porcelainStart,
  porcelainStop,
  porcelainRead,
  porcelainRepo,
  porcelainFixture,
  porcelainPairingLink,
  porcelainHits,
  porcelainProjectHome,
  porcelainCodingTool,
};
