export type CheckoutVerifier = (
  checkout: string,
  metadataIdentity: string,
  repositoryIdentity: string,
  signal?: AbortSignal,
) => Promise<void>;

export type CheckoutSession = {
  readonly path: string;
  verify(signal?: AbortSignal): Promise<void>;
  confirm(signal?: AbortSignal): Promise<void>;
  conversionFilters(read: () => Promise<string[]>): Promise<string[]>;
};

export type GitSession = {
  checkout(
    path: string,
    metadataIdentity: string,
    repositoryIdentity: string,
  ): CheckoutSession;
  confirmAll(signal?: AbortSignal): Promise<void>;
};
