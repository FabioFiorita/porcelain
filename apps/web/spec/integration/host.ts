import { rmSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { buildIsolatedServer } from '@porcelain/server/kit/sandbox';
import type { BrowserCommand, BrowserCommandContext } from 'vitest/node';
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

type Lane = {
  world: World | undefined;
  target: string;
  retarget: Array<(address: string) => void>;
};

const webRoot = resolve(import.meta.dirname, '../..');
const repositoryRoot = resolve(webRoot, '../..');
const evidenceRoot = join(webRoot, 'test-results', 'integration');
const lanes = new Map<string, Lane>();
let build: Promise<string> | undefined;

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

function lane(name: string): Lane {
  const found = lanes.get(name) ?? {
    world: undefined,
    target: 'http://127.0.0.1',
    retarget: [],
  };
  lanes.set(name, found);
  return found;
}

function world(context: BrowserCommandContext): World {
  const current = lane(context.project.name).world;
  if (current === undefined)
    throw new Error(
      'The integration fixtures start a disposable server before a test reaches it.',
    );
  return current;
}

export function proxyFor(name: string) {
  return {
    '^/(api|review-summaries)(/|$)': {
      target: lane(name).target,
      ws: true,
      configure(_proxy: unknown, options: { target?: unknown }) {
        options.target = lane(name).target;
        lane(name).retarget.push((address) => {
          options.target = address;
        });
      },
    },
  };
}

const porcelainStart: BrowserCommand<[], void> = async (context) => {
  const current = lane(context.project.name);
  if (current.world !== undefined) await current.world.stop();
  current.world = await World.start(repositoryRoot, await serverBuild());
  current.target = current.world.server.address;
  for (const change of current.retarget) change(current.target);
};

const porcelainStop: BrowserCommand<[string], string[]> = async (
  context,
  name,
) => {
  const stopping = world(context);
  lane(context.project.name).world = undefined;
  await stopping.keepEvidence(
    join(evidenceRoot, name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()),
  );
  return stopping.stop();
};

const porcelainRead: BrowserCommand<[ServerRead], ServerAnswer> = (
  context,
  request,
) => world(context).read(request);

const porcelainRepo: BrowserCommand<[RepoStep, ServerName], string> = (
  context,
  step,
  server,
) => world(context).repo(step, server);

const porcelainFixture: BrowserCommand<[ServerName], RepoFixture> = (
  context,
  server,
) => world(context).fixture(server);

const porcelainPairingLink: BrowserCommand<
  [string, ServerName, boolean?],
  PairingParts
> = (context, label, server, trusted) =>
  world(context).pairingLink(label, server, trusted);

const porcelainHits: BrowserCommand<[ServerName], ServerHit[]> = (
  context,
  server,
) => world(context).hits(server);

const porcelainProjectHome: BrowserCommand<
  [ProjectHomeStep, ServerName],
  string
> = (context, step, server) => world(context).projectHome(step, server);

const porcelainCodingTool: BrowserCommand<[], CodingToolReplies> = (context) =>
  world(context).codingTool();

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
