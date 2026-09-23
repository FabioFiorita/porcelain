import type { InventoryResponse } from '@porcelain/contracts/projects';

type ReadInventory = (signal?: AbortSignal) => Promise<InventoryResponse>;

export class ReadInventoryController {
  private readonly readInventory: ReadInventory;

  constructor(readInventory: ReadInventory) {
    this.readInventory = readInventory;
  }

  execute(context: { signal?: AbortSignal }): Promise<InventoryResponse> {
    return this.readInventory(context.signal);
  }
}
