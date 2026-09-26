export interface CheckoutSession {
  readonly path: string;
  verify(signal?: AbortSignal): Promise<void>;
  confirm(signal?: AbortSignal): Promise<void>;
  conversionFilters(read: () => Promise<string[]>): Promise<string[]>;
}

export interface GitSession {
  checkout(
    path: string,
    metadataIdentity: string,
    repositoryIdentity: string,
  ): CheckoutSession;
  confirmAll(signal?: AbortSignal): Promise<void>;
}
