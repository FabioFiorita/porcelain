/** Confirms a checkout is still the one the request was authorised for. */
export type CheckoutVerifier = (
  checkout: string,
  metadataIdentity: string,
  repositoryIdentity: string,
  signal?: AbortSignal,
) => Promise<void>;

/**
 * The guarded state for one checkout, for the length of one request: identity
 * is verified once before the first read, and again through {@link confirm}
 * immediately before a derived result is cached, stored, or sent to another
 * process.
 */
export type CheckoutSession = {
  readonly path: string;
  verify(signal?: AbortSignal): Promise<void>;
  confirm(signal?: AbortSignal): Promise<void>;
  conversionFilters(read: () => Promise<string[]>): Promise<string[]>;
};

/**
 * One request's Git state. A request that touches several repositories keeps
 * each checkout's guard separate, so verifying one never vouches for another.
 */
export type GitSession = {
  checkout(
    path: string,
    metadataIdentity: string,
    repositoryIdentity: string,
  ): CheckoutSession;
  confirmAll(signal?: AbortSignal): Promise<void>;
};
