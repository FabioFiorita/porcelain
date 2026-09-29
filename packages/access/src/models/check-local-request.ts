export type CheckLocalRequestInput = {
  host: string | undefined;
  remoteAddress: string | undefined;
  localAddress: string | undefined;
  headers: readonly string[];
  origin?: string | undefined;
  referer?: string | undefined;
  fetchSite?: string | undefined;
};

export type CheckLocalRequestResult = { kind: 'local' } | { kind: 'remote' };
