import type { Inventory } from '../../models/inventory.ts';
import type { Project } from '../../models/project.ts';

export interface InventoryStore {
  read(): Inventory;
  save(project: Project): void;
}
