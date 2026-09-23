import type { InventoryReport } from '../models/inventory-report.ts';
import type { ComposeInventoryInput } from '../models/inventory-operations.ts';
import { projectReport } from '../rules/project-report.ts';
import type { InventoryStore } from '../ports/inventory-store.ts';

export class ComposeInventoryService {
  private readonly inventoryStore: InventoryStore;

  constructor(inventoryStore: InventoryStore) {
    this.inventoryStore = inventoryStore;
  }

  execute(input: ComposeInventoryInput): InventoryReport {
    const inventory = this.inventoryStore.read();
    const listings = new Map(
      input.listings.map((listing) => [listing.projectId, listing]),
    );
    return {
      environmentId: inventory.environmentId,
      projects: inventory.projects.flatMap((project) => {
        const listing = listings.get(project.id);
        return listing ? [projectReport(project, listing, input.statuses)] : [];
      }),
    };
  }
}
