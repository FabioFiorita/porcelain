import type { AccessListing } from '@porcelain/access/models';
import type { ListAccessService } from '@porcelain/access/services';

type RunStored = <T>(operation: () => T | Promise<T>) => Promise<T>;

export class ListAccessController {
  private readonly list: ListAccessService;
  private readonly runStored: RunStored;

  constructor(list: ListAccessService, runStored: RunStored) {
    this.list = list;
    this.runStored = runStored;
  }

  execute(): Promise<AccessListing> {
    return this.runStored(() => this.list.execute());
  }
}
