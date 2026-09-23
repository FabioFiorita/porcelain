import type { RevokeAccessService } from '@porcelain/access/services';

type RunStored = <T>(operation: () => T | Promise<T>) => Promise<T>;

export class RevokeAccessController {
  private readonly revoke: RevokeAccessService;
  private readonly runStored: RunStored;

  constructor(revoke: RevokeAccessService, runStored: RunStored) {
    this.revoke = revoke;
    this.runStored = runStored;
  }

  execute(input: { id: string }): Promise<{
    revoked: boolean;
    kind?: 'grant' | 'device';
  }> {
    return this.runStored(() => this.revoke.execute(input.id));
  }
}
