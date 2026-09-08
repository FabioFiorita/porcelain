import type { DiscoveryIssue } from './git/dtos/discovery-issue.ts';
import type { CommentCommand, CommentThread } from './models/comment-thread.ts';
import type { Inventory } from './models/inventory.ts';
import type { Project } from './models/project.ts';

export interface Application {
  comments(
    command: CommentCommand,
    signal?: AbortSignal,
  ): Promise<CommentThread[]>;
  inventory(): Inventory;
  register(
    checkout: string,
    signal?: AbortSignal,
  ): Promise<{ project: Project; issues: DiscoveryIssue[] }>;
  refresh(
    signal?: AbortSignal,
  ): Promise<{ inventory: Inventory; issues: DiscoveryIssue[] }>;
  close(): Promise<void>;
}
