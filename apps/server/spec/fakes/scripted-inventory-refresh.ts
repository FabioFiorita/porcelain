import { Effect } from 'effect';
import type { CatalogSnapshot } from '@porcelain/projects/models';
import type { WorktreeCatalogStore } from '@porcelain/projects/ports';
import type { JobRunner } from '../../src/ports/job-runner.ts';

export class ScriptedInventoryRefresh implements JobRunner {
  private readonly catalog: WorktreeCatalogStore;
  private readonly refreshed: CatalogSnapshot;

  constructor(catalog: WorktreeCatalogStore, refreshed: CatalogSnapshot) {
    this.catalog = catalog;
    this.refreshed = refreshed;
  }

  execute(): Effect.Effect<void> {
    return Effect.sync(() => {
      this.catalog.save(this.refreshed);
    });
  }
}
