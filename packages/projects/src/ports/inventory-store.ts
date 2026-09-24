import type {
  Inventory,
  ProjectKey,
  RegisteredProject,
} from '../models/project.ts';

export interface InventoryStore {
  read(): Inventory;
  find(input: ProjectKey): RegisteredProject | undefined;
  save(input: RegisteredProject): void;
  markAllUnavailable(): void;
  remove(input: ProjectKey): void;
}
