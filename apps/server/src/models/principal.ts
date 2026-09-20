/**
 * Who is calling, decided by the door they came through: the owner reaches the
 * local socket, agents present bearer credentials over MCP, viewers are paired
 * devices.  `deviceId` is null rather than absent so that pairing cannot skip
 * the lookup without the compiler noticing.
 */
export type AuthenticatedPrincipal =
  | { kind: 'owner' }
  | { kind: 'agent' }
  | { kind: 'viewer'; deviceId: string | null };

/**
 * Every request carries one of these from the moment it arrives, including the
 * public ones — health, static files and ending a browser session never run an
 * authentication hook.  Keeping the unauthenticated state in the type means a
 * permission check added in pairing has to answer for it rather than read an
 * absent value through a non-optional property.
 */
export type Principal = AuthenticatedPrincipal | { kind: 'anonymous' };
