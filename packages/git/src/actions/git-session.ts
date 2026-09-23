import { verifyCheckout } from '../inspection/commands/verify-checkout.ts';
import type {
  CheckoutSession as CheckoutSessionPort,
  CheckoutVerifier,
  GitSession as GitSessionPort,
} from '../inspection/interfaces/git-session.ts';

export class RequestCheckoutSession implements CheckoutSessionPort {
  readonly path: string;
  private readonly metadataIdentity: string;
  private readonly repositoryIdentity: string;
  private readonly verifier: CheckoutVerifier;
  private verified: Promise<void> | undefined;
  private filters: Promise<string[]> | undefined;

  constructor(
    path: string,
    metadataIdentity: string,
    repositoryIdentity: string,
    verifier: CheckoutVerifier = verifyCheckout,
  ) {
    this.path = path;
    this.metadataIdentity = metadataIdentity;
    this.repositoryIdentity = repositoryIdentity;
    this.verifier = verifier;
  }

  verify(signal?: AbortSignal): Promise<void> {
    this.verified ??= this.verifier(
      this.path,
      this.metadataIdentity,
      this.repositoryIdentity,
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
  private readonly verifier: CheckoutVerifier;

  constructor(verifier: CheckoutVerifier = verifyCheckout) {
    this.verifier = verifier;
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
      this.verifier,
    );
    this.checkouts.set(key, created);
    return created;
  }
}
