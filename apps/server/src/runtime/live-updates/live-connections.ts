import type { LiveNotice } from '@porcelain/contracts/access';
import type { LiveChannel } from '../../ports/live-channel.ts';
import type { LiveClient } from '../../ports/live-client.ts';
import type { LiveConnector } from '../../ports/live-connector.ts';

type Connection = {
  channel: LiveChannel;
  projects: ReadonlySet<string>;
  worktrees: ReadonlyMap<string, string>;
  answered: boolean;
};

export class LiveConnections implements LiveConnector {
  private readonly connections = new Set<Connection>();

  connect(channel: LiveChannel): LiveClient {
    const connection: Connection = {
      channel,
      projects: new Set(),
      worktrees: new Map(),
      answered: true,
    };
    this.connections.add(connection);
    channel.send({ type: 'ready' });
    return {
      follow: (targets) => {
        if (!this.connections.has(connection)) return;
        connection.projects = new Set(targets.projects);
        connection.worktrees = new Map(
          targets.worktrees.map((entry) => [entry.worktreeId, entry.projectId]),
        );
      },
      answered: () => {
        connection.answered = true;
      },
      close: () => {
        this.connections.delete(connection);
      },
    };
  }

  toEveryone(notice: LiveNotice): void {
    for (const connection of this.connections) connection.channel.send(notice);
  }

  toProject(projectId: string, notice: LiveNotice): void {
    for (const connection of this.connections)
      if (connection.projects.has(projectId)) connection.channel.send(notice);
  }

  toWorktree(
    worktreeId: string,
    notice: (projectId: string) => LiveNotice,
  ): void {
    for (const connection of this.connections) {
      const projectId = connection.worktrees.get(worktreeId);
      if (projectId !== undefined) connection.channel.send(notice(projectId));
    }
  }

  toProjectOrWorktree(
    projectId: string,
    worktreeId: string,
    notice: LiveNotice,
  ): void {
    for (const connection of this.connections)
      if (
        connection.projects.has(projectId) ||
        connection.worktrees.get(worktreeId) === projectId
      )
        connection.channel.send(notice);
  }

  ping(): void {
    for (const connection of this.connections) {
      if (!connection.answered) {
        this.connections.delete(connection);
        connection.channel.terminate();
        continue;
      }
      connection.answered = false;
      connection.channel.ping();
    }
  }

  close(): void {
    this.connections.clear();
  }
}

export class LiveHeartbeat {
  private readonly connections: LiveConnections;

  constructor(connections: LiveConnections) {
    this.connections = connections;
  }

  async execute(): Promise<void> {
    this.connections.toEveryone({ type: 'heartbeat' });
  }
}

export class LivePing {
  private readonly connections: LiveConnections;

  constructor(connections: LiveConnections) {
    this.connections = connections;
  }

  async execute(): Promise<void> {
    this.connections.ping();
  }
}
