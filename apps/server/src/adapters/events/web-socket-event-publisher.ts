import type { GitActionReceiptView } from '@porcelain/git-actions/models';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { LiveConnections } from '../../runtime/live-updates/live-connections.ts';

export class WebSocketEventPublisher implements EventPublisher {
  private readonly connections: LiveConnections;

  constructor(connections: LiveConnections) {
    this.connections = connections;
  }

  inventoryChanged(): void {
    this.connections.toEveryone({ type: 'inventory' });
  }

  projectChanged(projectId: string, change: 'preferences'): void {
    this.connections.toProject(projectId, {
      type: 'project',
      projectId,
      change,
    });
  }

  worktreeChanged(
    worktreeId: string,
    change: 'review' | 'reviewed' | 'comments' | 'git',
  ): void {
    this.connections.toWorktree(worktreeId, (projectId) => ({
      type: 'worktree',
      projectId,
      worktreeId,
      change,
    }));
  }

  filesChanged(worktreeId: string, _paths: readonly string[]): void {
    this.connections.toWorktree(worktreeId, (projectId) => ({
      type: 'worktree',
      projectId,
      worktreeId,
      change: 'files',
    }));
  }

  gitActionChanged(receipt: GitActionReceiptView): void {
    this.connections.toProjectOrWorktree(
      receipt.projectId,
      receipt.worktreeId,
      {
        type: 'git-action',
        projectId: receipt.projectId,
        worktreeId: receipt.worktreeId,
        receipt,
      },
    );
  }
}
