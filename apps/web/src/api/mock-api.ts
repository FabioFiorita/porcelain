import type { Api } from './api';
import {
  createInventoryMock,
  createMockStore,
  type MockScenario,
} from './inventory/mock';

declare global {
  interface Window {
    __PORCELAIN_SCENARIO__?: MockScenario;
    __PORCELAIN_MOCK__?: ReturnType<typeof createMockStore>;
  }
}

export function createMockApi(store: ReturnType<typeof createMockStore>): Api {
  return { inventory: createInventoryMock(store) };
}

export function createBootMockApi(): Api {
  const store = createMockStore(window.__PORCELAIN_SCENARIO__);
  window.__PORCELAIN_MOCK__ = store;
  return createMockApi(store);
}
