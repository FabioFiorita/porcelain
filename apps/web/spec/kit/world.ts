import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { issuePairingResponseSchema } from '@porcelain/contracts/access';
import { editFileRequestSchema } from '@porcelain/contracts/files';
import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import {
  IsolatedServer,
  kitHeaders,
  Recorder,
} from '@porcelain/server/kit/isolated-server';
import {
  read,
  sampleReview,
  toolCall,
  toolResult,
} from '@porcelain/server/kit/requests';
import type { HttpRequest, Session } from '@porcelain/server/kit/session';
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
} from './protocol.ts';

const proofScreenshot = 'proof-screenshot.png';
const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

export const remoteComputerName = 'Remote journey computer';
export const remoteProjectName = 'remote-sample';

async function mainWorktree(agent: Session) {
  const response = await agent.send({
    method: 'GET',
    path: '/api/inventory',
    headers: kitHeaders,
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
    headers: { ...request.headers, ...kitHeaders },
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

async function prepareRemote(server: IsolatedServer, recorder: Recorder) {
  const kit = server.session(recorder, { projectId: '', worktreeId: '' });
  await read(kit, {
    method: 'PUT',
    path: '/api/environment/name',
    headers: kitHeaders,
    body: { name: remoteComputerName },
  });
  const project = readInventoryResponseSchema.parse(
    await read(kit, {
      method: 'GET',
      path: '/api/inventory',
      headers: kitHeaders,
    }),
  ).projects[0];
  if (project === undefined)
    throw new Error('The remote computer has no project.');
  await read(kit, {
    method: 'PATCH',
    path: `/api/projects/${encodeURIComponent(project.id)}`,
    headers: kitHeaders,
    body: { name: remoteProjectName },
  });
}

export class World {
  readonly recorder = new Recorder();
  readonly server: IsolatedServer;
  private readonly root: string;
  private readonly build: string;
  private remote: Promise<IsolatedServer> | undefined;

  private constructor(server: IsolatedServer, root: string, build: string) {
    this.server = server;
    this.root = root;
    this.build = build;
    this.recorder.phase = 'follow-up';
    this.recorder.secret(server.credential);
    this.recorder.secret(server.desktopCredential);
  }

  static async start(root: string, build: string): Promise<World> {
    return new World(await IsolatedServer.start(root, build), root, build);
  }

  private remoteServer(): Promise<IsolatedServer> {
    this.remote ??= IsolatedServer.start(this.root, this.build).then(
      async (started) => {
        this.recorder.secret(started.credential);
        this.recorder.secret(started.desktopCredential);
        try {
          await prepareRemote(started, this.recorder);
          return started;
        } catch (error) {
          await started.stop();
          throw error;
        }
      },
    );
    return this.remote;
  }

  private handle(server: ServerName): Promise<IsolatedServer> {
    return server === 'remote'
      ? this.remoteServer()
      : Promise.resolve(this.server);
  }

  private async session(server: ServerName = 'this'): Promise<Session> {
    return (await this.handle(server)).session(this.recorder, {
      projectId: '',
      worktreeId: '',
    });
  }

  async read(request: ServerRead): Promise<ServerAnswer> {
    const response = await (
      await this.session(request.server)
    ).send({
      method: 'GET',
      path: request.path,
      target: request.target,
      headers: kitHeaders,
    });
    return { status: response.status, body: response.body };
  }

  async repo(step: RepoStep, server: ServerName): Promise<string> {
    const repository = await this.session(server);
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
  }

  async fixture(server: ServerName): Promise<RepoFixture> {
    const { fixture } = await this.handle(server);
    return {
      branch: fixture.branch,
      initialCommit: fixture.initialCommit,
      readme: fixture.readme,
    };
  }

  async pairingLink(
    label: string,
    server: ServerName,
    trusted = false,
  ): Promise<PairingParts> {
    const owner = await this.session(server);
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
    if (grant === undefined)
      throw new Error('The owner issued no pairing grant');
    return {
      code: grant.link.code,
      environmentId: grant.link.environmentId,
      address: owner.address,
    };
  }

  async hits(server: ServerName): Promise<ServerHit[]> {
    if (server === 'remote' && this.remote === undefined) return [];
    return (await this.handle(server)).hits();
  }

  async projectHome(step: ProjectHomeStep, server: ServerName) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(step.name))
      throw new Error(
        `${step.name} is not one lowercase folder name in the project home`,
      );
    const home = await this.session(server);
    const path = join(home.projectHome, step.name);
    if (step.kind === 'repository')
      await home.git('init', '--initial-branch', 'main', path);
    else await mkdir(path);
    return path;
  }

  async codingTool(): Promise<CodingToolReplies> {
    await (await this.session()).installCodingTool();
    const { message, groups } = this.server.fixture.codingTool;
    return { message, groups };
  }

  async keepEvidence(folder: string): Promise<void> {
    await mkdir(folder, { recursive: true });
    const servers: [string, IsolatedServer][] = [['server', this.server]];
    const remote = await this.remote?.catch(() => undefined);
    if (remote !== undefined) servers.push(['remote-server', remote]);
    await writeFile(
      join(folder, 'kit.json'),
      `${JSON.stringify(this.recorder.redact(this.recorder.steps), null, 2)}\n`,
    );
    for (const [name, server] of servers)
      await writeFile(
        join(folder, `${name}.json`),
        `${JSON.stringify(
          this.recorder.redact({
            hits: await server.hits(),
            logs: server.logs(),
          }),
          null,
          2,
        )}\n`,
      );
  }

  async stop(): Promise<string[]> {
    const remote = await this.remote?.catch(() => undefined);
    const stopped = await Promise.all([this.server.stop(), remote?.stop()]);
    return stopped.flatMap((message) =>
      message === undefined ? [] : [message],
    );
  }
}
