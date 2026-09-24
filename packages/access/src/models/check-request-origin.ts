export type CheckRequestOriginInput = {
  host: string | undefined;
  origin: string | undefined;
  method: string;
  scheme: string;
  localAddress: string | undefined;
  allowedHosts: readonly string[];
  requireSameOrigin: boolean;
};

export type CheckRequestOriginResult =
  | { kind: 'allowed' }
  | { kind: 'refused'; reason: string };
