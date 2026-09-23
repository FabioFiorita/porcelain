import type { Inventory, RegisteredProject } from '../models/project.ts';

export interface InventoryStore {
  read(): Inventory;
  save(project: RegisteredProject): void;
  markAllUnavailable(): void;
}
