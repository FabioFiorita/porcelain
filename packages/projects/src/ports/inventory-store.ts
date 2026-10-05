import { Context } from 'effect';
import {
  type Inventory,
  type ProjectKey,
  type RegisteredProject,
} from '../models/project.ts';

export interface InventoryStore {
  read(): Inventory;
  find(input: ProjectKey): RegisteredProject | undefined;
  save(input: RegisteredProject): void;
  markAllUnavailable(): void;
  remove(input: ProjectKey): void;
}

export const InventoryStore = Context.Service<
  '@porcelain/projects/InventoryStore',
  InventoryStore
>('@porcelain/projects/InventoryStore');
