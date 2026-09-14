import { readInventory, registerProject } from '@porcelain/client/inventory';
import type { InventoryPort } from './port';

export function createInventoryLive(transport: typeof fetch): InventoryPort {
  return {
    read: (options) =>
      readInventory({ ...options, endpoint: '/api', fetch: transport }),
    register: (options) =>
      registerProject({ ...options, endpoint: '/api', fetch: transport }),
  };
}
