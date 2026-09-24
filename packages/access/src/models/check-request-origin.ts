export type CheckRequestOriginInput = {
  host: string | undefined;
  origin: string | undefined;
  method: string;
  scheme: string;
  localAddress: string | undefined;
  allowedHosts: readonly string[];
  requireSameOrigin: boolean;
};

export type RequestOriginRefusal =
  | { kind: 'host-malformed' }
  | { kind: 'host-not-allowed'; hostname: string }
  | { kind: 'origin-required' }
  | { kind: 'origin-opaque' }
  | { kind: 'origin-malformed' }
  | { kind: 'cross-origin'; origin: string };

export type CheckRequestOriginResult =
  | { kind: 'allowed' }
  | { kind: 'refused'; refusal: RequestOriginRefusal };
