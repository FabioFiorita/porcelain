import type { Inventory } from '../../domain/inventory';
export type SessionPort = {
  restore(signal: AbortSignal): Promise<Inventory>;
  disconnect(): Promise<void>;
};
