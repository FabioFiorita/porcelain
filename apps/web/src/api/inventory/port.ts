import type { Inventory, Project } from '../../domain/inventory';

export type InventoryPort = {
  read(options: {
    token: string;
    signal: AbortSignal;
    refresh?: boolean;
  }): Promise<Inventory>;
  register(options: {
    token: string;
    signal: AbortSignal;
    path: string;
  }): Promise<Project>;
};
