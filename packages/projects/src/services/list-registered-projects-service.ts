import { Effect } from 'effect';
import type { ListRegisteredProjectsResult } from '../models/list-registered-projects.ts';
import type { InventoryStore } from '../ports/inventory-store.ts';

export class ListRegisteredProjectsService {
  private readonly inventory: InventoryStore;

  constructor(inventory: InventoryStore) {
    this.inventory = inventory;
  }

  execute(): Effect.Effect<ListRegisteredProjectsResult, never> {
    return Effect.sync(() => {
      return this.inventory.read();
    });
  }
}
