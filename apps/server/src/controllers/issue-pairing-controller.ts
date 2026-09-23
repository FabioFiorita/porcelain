import type { IssuedGrant } from '@porcelain/access/models';
import type { IssuePairingService } from '@porcelain/access/services';

type RunStored = <T>(operation: () => T | Promise<T>) => Promise<T>;

export class IssuePairingController {
  private readonly issue: IssuePairingService;
  private readonly runStored: RunStored;

  constructor(issue: IssuePairingService, runStored: RunStored) {
    this.issue = issue;
    this.runStored = runStored;
  }

  execute(input: {
    labels: string[];
    addresses: string[];
  }): Promise<{ grants: IssuedGrant[] }> {
    return this.runStored(() => ({
      grants: this.issue.execute(input.labels, input.addresses),
    }));
  }
}
