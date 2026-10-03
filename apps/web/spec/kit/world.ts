import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { agentActs } from '@porcelain/server/kit/agent';
import {
  IsolatedServer,
  kitHeaders,
  Recorder,
} from '@porcelain/server/kit/isolated-server';
import { prepareRemote } from '@porcelain/server/kit/remote-computer';
import { pairingGrant } from '@porcelain/server/kit/requests';
import type { Session } from '@porcelain/server/kit/session';
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
} from './protocol.ts';

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

  async revokeDevice(id: string, server: ServerName) {
    const response = await (
      await this.session(server)
    ).read({
      method: 'POST',
      path: '/access/revoke',
      target: 'owner',
      body: { id },
    });
    return response.body;
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
    if (step.kind === 'agent') {
      await agentActs(repository, step.action);
      return '';
    }
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
    return pairingGrant(await this.session(server), label, trusted);
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
