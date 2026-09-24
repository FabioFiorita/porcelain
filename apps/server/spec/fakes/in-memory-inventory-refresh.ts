export class InMemoryInventoryRefresh {
  private readonly inventory = { fresh: false };

  async execute(): Promise<void> {
    this.inventory.fresh = true;
  }

  isFresh(): boolean {
    return this.inventory.fresh;
  }
}
