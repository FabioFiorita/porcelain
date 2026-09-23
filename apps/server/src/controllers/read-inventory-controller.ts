import type { ReadInventoryResponse } from '@porcelain/contracts/projects';

type ReadInventory = (signal?: AbortSignal) => Promise<ReadInventoryResponse>;

export class ReadInventoryController {
  private readonly readInventory: ReadInventory;

  constructor(readInventory: ReadInventory) {
    this.readInventory = readInventory;
  }

  execute(context: { signal?: AbortSignal }): Promise<ReadInventoryResponse> {
    return this.readInventory(context.signal);
  }
}
