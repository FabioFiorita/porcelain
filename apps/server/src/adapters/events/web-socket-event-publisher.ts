import type { GitActionReceiptView } from '@porcelain/git-actions/models';
import type { Limits } from '../../config/limits.ts';
import type { EventPublisher, JobName } from '../../ports/event-publisher.ts';
import type { FollowedTargets } from '../../ports/followed-targets.ts';

type WorktreeChange = 'files' | 'git' | 'reviewed' | 'comments' | 'review';

export type LiveNotice =
  | { type: 'ready' }
  | { type: 'heartbeat' }
  | { type: 'inventory' }
  | {
      type: 'git-action';
      projectId: string;
      worktreeId: string;
      receipt: GitActionReceiptView;
    }
  | { type: 'project'; projectId: string; change: 'files' | 'preferences' }
  | {
      type: 'worktree';
      projectId: string;
      worktreeId: string;
      change: WorktreeChange;
    };

export type LiveUpdatesLimits = Pick<
  Limits['liveUpdates'],
  'maxConnections' | 'maxWatchedWorktrees' | 'burstMs' | 'heartbeatMs'
>;

export type LiveClient = {
  follow(targets: FollowedTargets): void;
  close(): void;
};

type Send = (notice: LiveNotice) => void;

type ClientState = {
  send: Send;
  projects: ReadonlySet<string>;
  worktrees: ReadonlyMap<string, string>;
};

export class WebSocketEventPublisher implements EventPublisher {
  private readonly clients = new Set<ClientState>();
  private readonly heartbeat: NodeJS.Timeout;

  constructor(options: { limits: Pick<LiveUpdatesLimits, 'heartbeatMs'> }) {
    this.heartbeat = setInterval(
      () => this.broadcast({ type: 'heartbeat' }),
      options.limits.heartbeatMs,
    );
    this.heartbeat.unref();
  }

  connect(send: Send): LiveClient {
    const state: ClientState = {
      send,
      projects: new Set(),
      worktrees: new Map(),
    };
    this.clients.add(state);
    send({ type: 'ready' });
    return {
      follow: (targets) => {
        if (!this.clients.has(state)) return;
        state.projects = new Set(targets.projects);
        state.worktrees = new Map(
          targets.worktrees.map((entry) => [entry.worktreeId, entry.projectId]),
        );
      },
      close: () => {
        this.clients.delete(state);
      },
    };
  }

  inventoryChanged(): void {
    this.broadcast({ type: 'inventory' });
  }

  projectChanged(projectId: string, change: 'preferences'): void {
    for (const client of this.clients)
      if (client.projects.has(projectId))
        client.send({ type: 'project', projectId, change });
  }

  worktreeChanged(
    worktreeId: string,
    change: 'review' | 'reviewed' | 'comments' | 'git',
  ): void {
    this.announceWorktree(worktreeId, change);
  }

  filesChanged(worktreeId: string, _paths: readonly string[]): void {
    this.announceWorktree(worktreeId, 'files');
  }

  gitActionChanged(receipt: GitActionReceiptView): void {
    const notice: LiveNotice = {
      type: 'git-action',
      projectId: receipt.projectId,
      worktreeId: receipt.worktreeId,
      receipt,
    };
    for (const client of this.clients)
      if (
        client.projects.has(receipt.projectId) ||
        client.worktrees.get(receipt.worktreeId) === receipt.projectId
      )
        client.send(notice);
  }

  jobFailed(job: JobName, error: unknown): void {
    const detail = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Porcelain job ${job} failed: ${detail}\n`);
  }

  async close(): Promise<void> {
    clearInterval(this.heartbeat);
    this.clients.clear();
  }

  private broadcast(notice: LiveNotice): void {
    for (const client of this.clients) client.send(notice);
  }

  private announceWorktree(worktreeId: string, change: WorktreeChange): void {
    for (const client of this.clients) {
      const projectId = client.worktrees.get(worktreeId);
      if (projectId !== undefined)
        client.send({ type: 'worktree', projectId, worktreeId, change });
    }
  }
}
