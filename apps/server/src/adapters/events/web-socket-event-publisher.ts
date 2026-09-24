import type { GitActionReceiptView } from '@porcelain/git-actions/models';
import type {
  EventPublisher,
  FilesChangedNotice,
  ProjectChangedNotice,
  WorktreeChangedNotice,
} from '../../ports/event-publisher.ts';
import type { LiveConnections } from '../../runtime/live-updates/live-connections.ts';

export class WebSocketEventPublisher implements EventPublisher {
  private readonly connections: LiveConnections;

  constructor(connections: LiveConnections) {
    this.connections = connections;
  }

  inventoryChanged(): void {
    this.connections.toEveryone({ type: 'inventory' });
  }

  projectChanged(input: ProjectChangedNotice): void {
    this.connections.toProject(input.projectId, {
      type: 'project',
      projectId: input.projectId,
      change: input.change,
    });
  }

  worktreeChanged(input: WorktreeChangedNotice): void {
    this.connections.toWorktree(input.worktreeId, (projectId) => ({
      type: 'worktree',
      projectId,
      worktreeId: input.worktreeId,
      change: input.change,
    }));
  }

  filesChanged(input: FilesChangedNotice): void {
    this.connections.toWorktree(input.worktreeId, (projectId) => ({
      type: 'worktree',
      projectId,
      worktreeId: input.worktreeId,
      change: 'files',
    }));
  }

  gitActionChanged(input: GitActionReceiptView): void {
    this.connections.toProjectOrWorktree(input.projectId, input.worktreeId, {
      type: 'git-action',
      projectId: input.projectId,
      worktreeId: input.worktreeId,
      receipt: input,
    });
  }
}
