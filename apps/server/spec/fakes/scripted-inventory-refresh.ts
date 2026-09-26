import type { CatalogSnapshot } from '@porcelain/projects/models';
import type { WorktreeCatalogStore } from '@porcelain/projects/ports';
import type { JobWork } from '../../src/ports/job-work.ts';

export class ScriptedInventoryRefresh implements JobWork {
  private readonly catalog: WorktreeCatalogStore;
  private readonly refreshed: CatalogSnapshot;

  constructor(catalog: WorktreeCatalogStore, refreshed: CatalogSnapshot) {
    this.catalog = catalog;
    this.refreshed = refreshed;
  }

  async execute(): Promise<void> {
    this.catalog.save(this.refreshed);
  }
}
