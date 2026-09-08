import { readDiff } from './commands/read-diff.ts';
import { readStatus } from './commands/read-status.ts';
import { verifyCheckout } from './commands/verify-checkout.ts';
import type { GitOrdinaryChange } from './dtos/git-status.ts';
import type { DiffReader } from './interfaces/diff-reader.ts';
import type { StatusReader } from './interfaces/status-reader.ts';

export class InspectionGit implements StatusReader, DiffReader {
  private readonly checkout: string;
  private readonly metadataIdentity: string;
  private readonly repositoryIdentity: string;

  constructor(
    checkout: string,
    metadataIdentity: string,
    repositoryIdentity: string,
  ) {
    this.checkout = checkout;
    this.metadataIdentity = metadataIdentity;
    this.repositoryIdentity = repositoryIdentity;
  }

  async readStatus(signal?: AbortSignal) {
    await verifyCheckout(
      this.checkout,
      this.metadataIdentity,
      this.repositoryIdentity,
      signal,
    );
    const result = await readStatus(this.checkout, signal);
    await verifyCheckout(
      this.checkout,
      this.metadataIdentity,
      this.repositoryIdentity,
      signal,
    );
    return result;
  }

  async readDiff(change: GitOrdinaryChange, signal?: AbortSignal) {
    await verifyCheckout(
      this.checkout,
      this.metadataIdentity,
      this.repositoryIdentity,
      signal,
    );
    const result = await readDiff(this.checkout, change, signal);
    await verifyCheckout(
      this.checkout,
      this.metadataIdentity,
      this.repositoryIdentity,
      signal,
    );
    return result;
  }
}
