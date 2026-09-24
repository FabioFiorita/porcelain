export class ScriptedInventoryRefresh {
  refreshes = 0;

  execute(): Promise<void> {
    this.refreshes += 1;
    return Promise.resolve();
  }
}
