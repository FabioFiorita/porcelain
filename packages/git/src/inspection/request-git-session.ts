import { verifyCheckout } from './commands/verify-checkout.ts';
import type {
  CheckoutSession as CheckoutSessionPort,
  GitSession as GitSessionPort,
} from './interfaces/git-session.ts';
import type { GitLimits } from '../shared/dtos/git-limits.ts';

export class RequestCheckoutSession implements CheckoutSessionPort {
  readonly path: string;
  private readonly metadataIdentity: string;
  private readonly repositoryIdentity: string;
  private readonly limits: GitLimits;
  private verified: Promise<void> | undefined;
  private filters: Promise<string[]> | undefined;

  constructor(
    path: string,
    metadataIdentity: string,
    repositoryIdentity: string,
    limits: GitLimits,
  ) {
    this.path = path;
    this.metadataIdentity = metadataIdentity;
    this.repositoryIdentity = repositoryIdentity;
    this.limits = limits;
  }

  verify(signal?: AbortSignal): Promise<void> {
    this.verified ??= verifyCheckout(
      this.path,
      this.metadataIdentity,
      this.repositoryIdentity,
      this.limits,
      signal,
    ).catch((cause: unknown) => {
      this.verified = undefined;
      throw cause;
    });
    return this.verified;
  }

  async confirm(signal?: AbortSignal): Promise<void> {
    this.verified = undefined;
    await this.verify(signal);
  }

  conversionFilters(read: () => Promise<string[]>): Promise<string[]> {
    this.filters ??= read().catch((cause: unknown) => {
      this.filters = undefined;
      throw cause;
    });
    return this.filters;
  }
}

export class RequestGitSession implements GitSessionPort {
  private readonly checkouts = new Map<string, RequestCheckoutSession>();
  private readonly limits: GitLimits;

  constructor(limits: GitLimits) {
    this.limits = limits;
  }

  async confirmAll(signal?: AbortSignal): Promise<void> {
    for (const checkout of this.checkouts.values())
      await checkout.confirm(signal);
  }

  checkout(
    path: string,
    metadataIdentity: string,
    repositoryIdentity: string,
  ): CheckoutSessionPort {
    const key = `${path}\0${metadataIdentity}\0${repositoryIdentity}`;
    const existing = this.checkouts.get(key);
    if (existing) return existing;
    const created = new RequestCheckoutSession(
      path,
      metadataIdentity,
      repositoryIdentity,
      this.limits,
    );
    this.checkouts.set(key, created);
    return created;
  }
}
