export type CheckLocalRequestInput = {
  host: string | undefined;
  remoteAddress: string | undefined;
  localAddress: string | undefined;
  headers: readonly string[];
};

export type CheckLocalRequestResult = { kind: 'local' } | { kind: 'remote' };
