import type { DiscoveryIssue } from './git/dtos/discovery-issue.ts';
import type { Inventory } from './models/inventory.ts';
import type { Project } from './models/project.ts';
import type { ReviewLayer, ReviewLayers } from './models/review-layers.ts';

export interface Application {
  reviewLayers(worktreeId: string): ReviewLayers;
  replaceReviewLayers(
    worktreeId: string,
    expectedRevision: number,
    layers: ReviewLayer[],
  ): Promise<ReviewLayers>;
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
