import type { Effect } from 'effect';
import { Context } from 'effect';
import {
  type Inventory,
  type ProjectKey,
  type RegisteredProject,
} from '../models/project.ts';

export interface InventoryStore {
  read(): Effect.Effect<Inventory>;
  find(input: ProjectKey): Effect.Effect<RegisteredProject | undefined>;
  save(input: RegisteredProject): Effect.Effect<void>;
  markAllUnavailable(): Effect.Effect<void>;
  remove(input: ProjectKey): Effect.Effect<void>;
}

export const InventoryStore = Context.Service<
  '@porcelain/projects/InventoryStore',
  InventoryStore
>('@porcelain/projects/InventoryStore');
