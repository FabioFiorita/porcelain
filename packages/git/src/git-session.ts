import { verifyCheckout } from './commands/verify-checkout.ts';
import type {
  CheckoutSession as CheckoutSessionPort,
  CheckoutVerifier,
  GitSession as GitSessionPort,
} from './interfaces/git-session.ts';

/**
 * The guarded state for one checkout, for the length of one request.
 *
 * Identity is verified once, before the first Git read of the request, instead
 * of before and after every call. The trailing check is deliberately gone: a
 * checkout swapped after the first verification is no longer detected, so a
 * read can return content from a different checkout. Because such a result can
 * be cached, stored or sent to another process, anything that lets a result
 * escape the request calls {@link confirm} immediately before it does.
 */
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

  /** Verifies the checkout on first use and reuses the answer afterwards. */
  verify(signal?: AbortSignal): Promise<void> {
    this.verified ??= this.verifier(
      this.path,
      this.metadataIdentity,
      this.repositoryIdentity,
      signal,
    ).catch((cause: unknown) => {
      // A failed guard must not be remembered as a passing one.
      this.verified = undefined;
      throw cause;
    });
    return this.verified;
  }

  /**
   * Verifies again, ignoring the earlier answer. Called immediately before a
   * result derived from this checkout is cached, stored, or sent outside the
   * process, so wrong-repository content cannot outlive the request.
   */
  async confirm(signal?: AbortSignal): Promise<void> {
    this.verified = undefined;
    await this.verify(signal);
  }

  /**
   * The conversion-filter check for this request. It scans every tracked file,
   * so it runs once rather than twice per read.
   */
  conversionFilters(read: () => Promise<string[]>): Promise<string[]> {
    this.filters ??= read().catch((cause: unknown) => {
      this.filters = undefined;
      throw cause;
    });
    return this.filters;
  }
}

/**
 * One request's Git state. A request that touches several repositories keeps
 * each checkout's guard separate, so verifying one never vouches for another.
 */
export class RequestGitSession implements GitSessionPort {
  private readonly checkouts = new Map<string, RequestCheckoutSession>();
  private readonly verifier: CheckoutVerifier;

  constructor(verifier: CheckoutVerifier = verifyCheckout) {
    this.verifier = verifier;
  }

  /**
   * Re-verifies every checkout this request has read, for callers about to
   * keep, store or send on a result derived from them.
   */
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
