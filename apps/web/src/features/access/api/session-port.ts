import type { Inventory } from '@/features/projects/index';
export type SessionPort = {
  restore(signal: AbortSignal): Promise<Inventory>;
  disconnect(): Promise<void>;
};
