import type { Api } from './api';
import { createInventoryLive } from './inventory/live';

export async function createBootApi(): Promise<Api> {
  if (import.meta.env.VITE_API_MODE === 'mock') {
    const { createBootMockApi } = await import('./mock-api');
    return createBootMockApi();
  }
  return { inventory: createInventoryLive(fetch) };
}
