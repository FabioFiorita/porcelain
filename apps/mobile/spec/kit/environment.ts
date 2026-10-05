import { Schema } from 'effect';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import {
  issuePairingResponseSchema,
  listAccessResponseSchema,
  pairingLink,
} from '@porcelain/contracts/access';
import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import {
  IsolatedServer,
  Recorder,
  type ServerHandle,
  type Hit,
} from '@porcelain/server/kit/isolated-server';
import { repositoryRoot } from './development-client.ts';

export type Workspace = { projectName: string; worktreeLabel: string };

export type NativeDevice = { label: string; platform: string };

export class Environment {
  readonly server: IsolatedServer;
  readonly recorder: Recorder;
  readonly name: string;
  readonly link: string;
  readonly workspace: Workspace | undefined;

  private constructor(input: {
    server: IsolatedServer;
    recorder: Recorder;
    name: string;
    link: string;
    workspace: Workspace | undefined;
  }) {
    this.server = input.server;
    this.recorder = input.recorder;
    this.name = input.name;
    this.link = input.link;
    this.workspace = input.workspace;
  }

  static async start(input: {
    build: string;
    title: string;
    label: string;
    workspace: boolean;
    onOutput?: (text: string) => void;
    port?: number;
  }): Promise<Environment> {
    const server = await IsolatedServer.start(
      repositoryRoot,
      input.build,
      undefined,
      input.onOutput,
      input.port,
    );
    const recorder = new Recorder();
    recorder.secret(server.credential);
    recorder.secret(server.desktopCredential);
    try {
      const name = `Mobile ${input.title} ${randomUUID().slice(0, 8)}`;
      const workspace = input.workspace
        ? await addWorkspace(server, recorder, input.title, name)
        : undefined;
      await server.read(recorder, {
        method: 'PUT',
        path: '/api/environment/name',
        body: { name },
      });
      const link = await issuePairingLink(server, recorder, input.label);
      recorder.phase = 'follow-up';
      return new Environment({ server, recorder, name, link, workspace });
    } catch (error) {
      await server.stop();
      throw error;
    }
  }

  private async nativeDevices() {
    const access = Schema.decodeUnknownSync(listAccessResponseSchema)(
      (
        await this.server.read(this.recorder, {
          method: 'GET',
          path: '/access',
          target: 'owner',
        })
      ).body,
    );
    const kit = this.server.fixture.device;
    return access.devices.filter(
      (device) =>
        device.label !== kit.label || device.platform !== kit.platform,
    );
  }

  async devices(): Promise<NativeDevice[]> {
    return (await this.nativeDevices()).map(({ label, platform }) => ({
      label,
      platform,
    }));
  }

  async revokeDevices(): Promise<void> {
    for (const device of await this.nativeDevices())
      await this.server.read(this.recorder, {
        method: 'POST',
        path: '/access/revoke',
        target: 'owner',
        body: { id: device.id },
      });
  }

  async nativeHits(method: string, route: string): Promise<Hit[]> {
    return (await this.server.hits()).filter(
      (hit) =>
        !hit.kit &&
        hit.method === method &&
        hit.route === route &&
        hit.status === 200,
    );
  }

  stop(): Promise<string | undefined> {
    return this.server.stop();
  }
}

export async function issuePairingLink(
  server: ServerHandle,
  recorder: Recorder,
  label: string,
): Promise<string> {
  const issued = Schema.decodeUnknownSync(issuePairingResponseSchema)(
    (
      await server.read(recorder, {
        method: 'POST',
        path: '/pairings',
        target: 'owner',
        body: { labels: [label], addresses: [server.address] },
      })
    ).body,
  );
  const [grant] = issued.grants;
  if (grant === undefined)
    throw new Error('The disposable server issued no pairing grant.');
  const link = pairingLink({
    addresses: [server.address],
    code: grant.code,
    environmentId: grant.link.environmentId,
  });
  recorder.secret(grant.code);
  recorder.secret(link);
  return link;
}

async function addWorkspace(
  server: IsolatedServer,
  recorder: Recorder,
  title: string,
  name: string,
): Promise<Workspace> {
  const inventory = Schema.decodeUnknownSync(readInventoryResponseSchema)(
    (await server.read(recorder, { method: 'GET', path: '/api/inventory' }))
      .body,
  );
  const [project] = inventory.projects;
  const main = project?.worktrees.find((worktree) => worktree.main);
  if (project === undefined || main === undefined)
    throw new Error(
      'The sample inventory has no project with a main worktree.',
    );
  const worktreeLabel = `mobile-${title.toLowerCase()}`;
  const projectName = `${name} project`;
  await server
    .session(recorder, { projectId: project.id, worktreeId: main.id })
    .git(
      'worktree',
      'add',
      '-b',
      worktreeLabel,
      join(server.projectHome, worktreeLabel),
    );
  await server.read(recorder, {
    method: 'PATCH',
    path: `/api/projects/${encodeURIComponent(project.id)}`,
    body: { name: projectName },
  });
  return { projectName, worktreeLabel };
}
