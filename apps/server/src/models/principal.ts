export type AuthenticatedPrincipal =
  | { kind: 'owner' }
  | { kind: 'agent' }
  | { kind: 'viewer'; deviceId: string | null };

export type Principal = AuthenticatedPrincipal | { kind: 'anonymous' };
