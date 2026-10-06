import type { IncomingMessage } from 'node:http';
import { join, resolve } from 'node:path';
import { temporaryServerBuild } from '@porcelain/server/kit/sandbox';
import type {
  BrowserCommand,
  BrowserCommandContext,
  TestProject,
} from 'vitest/node';
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
import { replaceEditorContent } from '../kit/editor.ts';

declare module 'vitest' {
  export interface ProvidedContext {
    serverBuild: string;
  }
}

const webRoot = resolve(import.meta.dirname, '../..');
const repositoryRoot = resolve(webRoot, '../..');
const evidenceRoot = join(webRoot, 'test-results', 'integration');
const sessionCookie = 'porcelain-session';
const worlds = new Map<string, World>();
let proxied: { target?: unknown } | undefined;

export default async function setup(project: TestProject) {
  const build = await temporaryServerBuild();
  project.provide('serverBuild', build.folder);
  return async () => {
    try {
      const interrupted = await Promise.allSettled(
        [...worlds.entries()].map(async ([session, current]) => {
          const evidence = await Promise.allSettled([
            current.keepEvidence(join(evidenceRoot, `interrupted-${session}`)),
          ]);
          const failures: unknown[] = await current.stop();
          for (const result of evidence)
            if (result.status === 'rejected') failures.push(result.reason);
          if (failures.length > 0)
            throw new AggregateError(
              failures,
              'An interrupted browser fixture could not retain evidence and stop.',
            );
        }),
      );
      const failures: unknown[] = [];
      for (const result of interrupted)
        if (result.status === 'rejected') failures.push(result.reason);
      if (failures.length > 0)
        throw new AggregateError(
          failures,
          'Interrupted browser fixtures could not retain evidence and stop.',
        );
    } finally {
      worlds.clear();
      await build.remove();
    }
  };
}

function sessionOf(cookies: string | undefined): string | undefined {
  for (const cookie of cookies?.split(';') ?? []) {
    const [name, value] = cookie.trim().split('=');
    if (name === sessionCookie) return value;
  }
  return undefined;
}

function world(context: BrowserCommandContext): World {
  const current = worlds.get(context.sessionId);
  if (current === undefined)
    throw new Error(
      'The integration fixtures start a disposable server before a test reaches it.',
    );
  return current;
}

export const serverProxy = {
  '^/(api|review-summaries)(/|$)': {
    target: 'http://127.0.0.1',
    ws: true,
    configure(_proxy: unknown, options: { target?: unknown }) {
      proxied = options;
    },
    bypass(request: IncomingMessage) {
      const session = sessionOf(request.headers.cookie);
      const address =
        session === undefined ? undefined : worlds.get(session)?.server.address;
      if (proxied === undefined || address === undefined) return false;
      proxied.target = address;
      return undefined;
    },
  },
};

const porcelainStart: BrowserCommand<[], void> = async (context) => {
  await worlds.get(context.sessionId)?.stop();
  worlds.set(
    context.sessionId,
    await World.start(
      repositoryRoot,
      context.project.getProvidedContext().serverBuild,
    ),
  );
  await context.context.addCookies([
    {
      name: sessionCookie,
      value: context.sessionId,
      url: new URL(context.page.url()).origin,
    },
  ]);
};

const porcelainStop: BrowserCommand<[string], string[]> = async (
  context,
  name,
) => {
  const stopping = world(context);
  worlds.delete(context.sessionId);
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

const porcelainReplaceEditorContent: BrowserCommand<[string, string], void> = (
  context,
  selector,
  text,
) => replaceEditorContent(context.iframe.locator(selector), text);

export const hostCommands = {
  porcelainReplaceEditorContent,
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
