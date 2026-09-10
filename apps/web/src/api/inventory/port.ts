import type { Inventory } from '../../domain/inventory';

export type InventoryPort = {
  read(options: {
    token: string;
    signal: AbortSignal;
    refresh?: boolean;
  }): Promise<Inventory>;
};
