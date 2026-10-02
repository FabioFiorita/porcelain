import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { issuePairingResponseSchema } from '@porcelain/contracts/access';
import { editFileRequestSchema } from '@porcelain/contracts/files';
import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import type { BrowserCommand } from 'vitest/node';
import type {
  AgentAction,
  CodingToolReplies,
  PairingParts,
  ProjectHomeStep,
  RepoFixture,
  RepoStep,
  ServerAnswer,
  ServerHit,
  ServerName,
  ServerRead,
} from '../../../../apps/web/spec/kit/protocol.ts';
import type {
  HttpRequest,
  Session,
} from '../../server-verify/scripts/feature.ts';
import {
  read,
  sampleReview,
  toolCall,
  toolResult,
} from '../../server-verify/scripts/fixture.ts';
import {
  Recorder,
  ServerHandle,
  type IsolatedServer,
} from '../../server-verify/scripts/session.ts';

export const journeyHeader = { 'x-porcelain-journey': 'kit' };
const proofScreenshot = 'proof-screenshot.png';
const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

let recorder = new Recorder();
recorder.phase = 'follow-up';
let attached: Promise<ServerHandle> | undefined;
let evidenceFolder: string | undefined;
let remote:
  | {
      start: () => Promise<IsolatedServer>;
      started?: Promise<IsolatedServer>;
    }
  | undefined;

export const remoteComputerName = 'Remote journey computer';
export const remoteProjectName = 'remote-sample';

export function setJourneyServer(
  manifest: string,
  evidence: string,
  startRemote?: () => Promise<IsolatedServer>,
): void {
  recorder = new Recorder();
  recorder.phase = 'follow-up';
  attached = ServerHandle.attach(manifest);
  evidenceFolder = evidence;
  remote = startRemote === undefined ? undefined : { start: startRemote };
}

export function takeJourneyRemote(): Promise<IsolatedServer> | undefined {
  const started = remote?.started;
  remote = undefined;
  return started;
}

async function prepareRemote(start: () => Promise<IsolatedServer>) {
  const started = await start();
  try {
    const kit = started.session(recorder, { projectId: '', worktreeId: '' });
    await read(kit, {
      method: 'PUT',
      path: '/api/environment/name',
      headers: journeyHeader,
      body: { name: remoteComputerName },
    });
    const project = readInventoryResponseSchema.parse(
      await read(kit, {
        method: 'GET',
        path: '/api/inventory',
        headers: journeyHeader,
      }),
    ).projects[0];
    if (project === undefined)
      throw new Error('The remote computer has no project.');
    await read(kit, {
      method: 'PATCH',
      path: `/api/projects/${encodeURIComponent(project.id)}`,
      headers: journeyHeader,
      body: { name: remoteProjectName },
    });
    return started;
  } catch (error) {
    await started.stop();
    throw error;
  }
}

function remoteHandle(): Promise<IsolatedServer> {
  if (remote === undefined)
    throw new Error(
      'Journeys run through pnpm verify:web, which starts the remote computer when a journey first asks for it.',
    );
  remote.started ??= prepareRemote(remote.start);
  return remote.started;
}

function handle(): Promise<ServerHandle> {
  if (attached !== undefined) return attached;
  const manifest = process.env.PORCELAIN_WEB_MANIFEST;
  if (manifest === undefined || manifest === '')
    throw new Error(
      'Journeys run through pnpm verify:web, which starts their isolated server.',
    );
  attached ??= ServerHandle.attach(manifest);
  return attached;
}

function handleOf(server: ServerName): Promise<ServerHandle> {
  return server === 'remote' ? remoteHandle() : handle();
}

async function session(server: ServerName = 'this') {
  return (await handleOf(server)).session(recorder, {
    projectId: '',
    worktreeId: '',
  });
}

async function keepEvidence() {
  const evidence = evidenceFolder ?? process.env.PORCELAIN_WEB_EVIDENCE;
  if (evidence === undefined || evidence === '') return;
  await writeFile(
    join(evidence, 'kit.json'),
    `${JSON.stringify(recorder.redact(recorder.steps), null, 2)}\n`,
  );
}

const porcelainRead: BrowserCommand<[ServerRead], ServerAnswer> = async (
  _context,
  request,
) => {
  const response = await (
    await session(request.server)
  ).send({
    method: 'GET',
    path: request.path,
    target: request.target,
    headers: journeyHeader,
  });
  await keepEvidence();
  return { status: response.status, body: response.body };
};

async function mainWorktree(agent: Session) {
  const response = await agent.send({
    method: 'GET',
    path: '/api/inventory',
    headers: journeyHeader,
  });
  const worktree = readInventoryResponseSchema
    .parse(response.body)
    .projects[0]?.worktrees.find((entry) => entry.main);
  if (worktree === undefined)
    throw new Error('The isolated server has no main worktree.');
  return worktree.id;
}

async function agentRequest(
  agent: Session,
  action: AgentAction,
): Promise<HttpRequest> {
  if (action.kind === 'edit-file')
    return {
      method: 'POST',
      path: `/api/worktrees/${encodeURIComponent(await mainWorktree(agent))}/files`,
      body: editFileRequestSchema.parse(action.edit),
    };
  if (action.kind === 'publish-proof') {
    const layerId = randomUUID();
    return toolCall(agent, 1, 'publish_review', {
      ...sampleReview(agent, 0, layerId, randomUUID(), { title: action.title }),
      proof: {
        checks: action.checks.map((check) => ({ ...check, layerId })),
        assets: [
          { kind: 'image', title: action.screenshot, path: proofScreenshot },
        ],
      },
    });
  }
  if (action.kind === 'reply')
    return toolCall(agent, 1, 'reply_to_comment', {
      threadId: action.threadId,
      body: action.body,
    });
  return action.kind === 'publish-review'
    ? toolCall(agent, 1, 'publish_review', {
        ...sampleReview(agent, 0, randomUUID(), randomUUID(), {
          title: action.title,
          kind: action.step,
        }),
        ...(action.summaryHtml === undefined
          ? {}
          : { summaryHtml: action.summaryHtml }),
      })
    : toolCall(agent, 1, 'create_comment', {
        anchor: { kind: 'file', filePath: action.path },
        body: action.body,
      });
}

async function agentActs(agent: Session, action: AgentAction) {
  const request = await agentRequest(agent, action);
  if (action.kind === 'publish-proof')
    await agent.writeFile(proofScreenshot, onePixelPng);
  const response = await agent.send({
    ...request,
    headers: { ...request.headers, ...journeyHeader },
  });
  if (action.kind === 'publish-proof') await agent.remove(proofScreenshot);
  if (
    response.status !== 200 ||
    (action.kind !== 'edit-file' && toolResult(response.body).isError === true)
  )
    throw new Error(
      `The agent's ${action.kind} was refused: ${JSON.stringify(response.body)}`,
    );
  return '';
}

const porcelainRepo: BrowserCommand<[RepoStep, ServerName], string> = async (
  _context,
  step,
  server,
) => {
  const repository = await session(server);
  const done = await (async () => {
    if (step.kind === 'agent') return agentActs(repository, step.action);
    if (step.kind === 'write') {
      await repository.writeFile(step.path, step.text);
      return '';
    }
    if (step.kind === 'remove') {
      await repository.remove(step.path);
      return '';
    }
    if (step.kind === 'read') return repository.readFile(step.path);
    if (step.kind === 'commit') {
      await repository.git('add', '--all');
      return repository.git('commit', '--message', step.message);
    }
    if (step.kind === 'branch') return repository.git('branch', step.name);
    if (step.kind === 'merge')
      return repository.git('merge', '--no-ff', '--no-edit', step.name);
    if (step.kind === 'fifo') {
      await repository.fifo(step.path);
      return '';
    }
    if (step.kind === 'remote')
      return repository.git('remote', 'add', step.name, step.url);
    if (step.kind === 'worktree')
      return repository.git(
        'worktree',
        'add',
        '-b',
        step.name,
        join(repository.projectHome, step.name),
      );
    return repository.git('switch', step.name);
  })();
  await keepEvidence();
  return done;
};

const porcelainFixture: BrowserCommand<[ServerName], RepoFixture> = async (
  _context,
  server,
) => {
  const { fixture } = await handleOf(server);
  return {
    branch: fixture.branch,
    initialCommit: fixture.initialCommit,
    readme: fixture.readme,
  };
};

const porcelainPairingLink: BrowserCommand<
  [string, ServerName, boolean?],
  PairingParts
> = async (_context, label, server, trusted = false) => {
  const owner = await session(server);
  const [grant] = issuePairingResponseSchema.parse(
    await read(owner, {
      method: 'POST',
      path: '/pairings',
      target: 'owner',
      body: {
        labels: [label],
        addresses: [owner.address],
        ...(trusted ? { trusted } : {}),
      },
    }),
  ).grants;
  await keepEvidence();
  if (grant === undefined) throw new Error('The owner issued no pairing grant');
  return {
    code: grant.link.code,
    environmentId: grant.link.environmentId,
    address: owner.address,
  };
};

const porcelainHits: BrowserCommand<[number, ServerName], ServerHit[]> = async (
  _context,
  since,
  server,
) => {
  if (server === 'remote' && remote?.started === undefined) return [];
  return (await (await handleOf(server)).hits()).slice(since);
};

const porcelainProjectHome: BrowserCommand<
  [ProjectHomeStep, ServerName],
  string
> = async (_context, step, server) => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(step.name))
    throw new Error(
      `${step.name} is not one lowercase folder name in the project home`,
    );
  const home = await session(server);
  const path = join(home.projectHome, step.name);
  if (step.kind === 'repository')
    await home.git('init', '--initial-branch', 'main', path);
  else await mkdir(path);
  await keepEvidence();
  return path;
};

const porcelainCodingTool: BrowserCommand<[], CodingToolReplies> = async () => {
  await (await session()).installCodingTool();
  await keepEvidence();
  const { message, groups } = (await handle()).fixture.codingTool;
  return { message, groups };
};

const initScripts = new WeakMap<object, Set<string>>();

const porcelainInitScript: BrowserCommand<[string], void> = async (
  context,
  content,
) => {
  const added = initScripts.get(context.page) ?? new Set<string>();
  initScripts.set(context.page, added);
  if (added.has(content)) return;
  added.add(content);
  await context.page.addInitScript({ content });
};

export const journeyCommands = {
  porcelainRead,
  porcelainRepo,
  porcelainFixture,
  porcelainPairingLink,
  porcelainHits,
  porcelainProjectHome,
  porcelainCodingTool,
  porcelainInitScript,
};
