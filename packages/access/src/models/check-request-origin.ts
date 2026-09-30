type CrossOriginPolicy = 'refused' | 'bearer' | 'ticket' | 'anyone';

type PresentedCredential = 'bearer' | 'ticket' | 'none';

export type CheckRequestOriginInput = {
  host: string | undefined;
  origin: string | undefined;
  method: string;
  scheme: string;
  localAddress: string | undefined;
  localPort: number | undefined;
  allowedHosts: readonly string[];
  requireSameOrigin: boolean;
  crossOrigin: CrossOriginPolicy;
  credential: PresentedCredential;
};

export type RequestOriginRefusal =
  | { kind: 'host-malformed' }
  | { kind: 'host-not-allowed'; hostname: string }
  | { kind: 'origin-required' }
  | { kind: 'origin-opaque' }
  | { kind: 'origin-malformed' }
  | { kind: 'cross-origin'; origin: string };

export type CheckRequestOriginResult =
  | { kind: 'allowed'; crossOrigin: boolean }
  | { kind: 'refused'; refusal: RequestOriginRefusal };
