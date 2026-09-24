import type { Clock } from '@porcelain/kernel/ports';
import type { RecordWorktreeCatalogInput } from '../models/worktree-catalog.ts';
import type { WorktreeCatalogStore } from '../ports/worktree-catalog-store.ts';
import { catalogSnapshot } from '../rules/worktree-catalog.ts';

export class RecordWorktreeCatalogService {
  private readonly catalog: WorktreeCatalogStore;
  private readonly clock: Clock;

  constructor(catalog: WorktreeCatalogStore, clock: Clock) {
    this.catalog = catalog;
    this.clock = clock;
  }

  execute(input: RecordWorktreeCatalogInput): void {
    this.catalog.save(
      catalogSnapshot(input.projects, input.listings, this.clock.now()),
    );
  }
}
