import type { Inventory, RegisteredProject } from '../models/project.ts';

export interface InventoryStore {
  read(): Inventory;
  save(input: RegisteredProject): void;
  markAllUnavailable(): void;
}
