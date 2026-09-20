import { inventoryResponseSchema } from '@porcelain/contracts/inventory';
import { describe, expect, it } from 'vitest';
import { createInventoryMock, createMockStore } from './mock';

describe('mock inventory', () => {
  it('returns contract-valid snapshots isolated from client mutation', async () => {
    const store = createMockStore();
    const api = createInventoryMock(store);
    const result = await api.read({
      signal: new AbortController().signal,
    });
    expect(inventoryResponseSchema.safeParse(result).success).toBe(true);
    result.projects.length = 0;
    expect(store.inventory.projects.length).toBeGreaterThan(0);
  });

  it('aborts delayed refresh without recording a completed operation', async () => {
    const store = createMockStore('slow');
    const controller = new AbortController();
    const pending = createInventoryMock(store).read({
      signal: controller.signal,
    });
    controller.abort();
    await expect(pending).rejects.toThrow();
    expect(store.refreshCount).toBe(0);
  });
});
