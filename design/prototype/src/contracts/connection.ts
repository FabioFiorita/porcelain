/**
 * PROPOSED in full (server review, section 1). The web app is served by one server
 * and shows that server only. A browser becomes a device by redeeming a pairing
 * link once (15 minutes, single use), which the owner makes with `porcelain pair`
 * on the server machine; the device token then lives in an HttpOnly cookie until
 * revoked or 90 days unused. Only the owner pairs and revokes, through the local
 * socket; a device cannot pair others.
 */

/** POST /api/pair. `code` comes from the pairing link (`…/pair#code=…`). */
export type PairRequest = { code: string; label: string };

export type Device = {
  id: string;
  label: string;
  pairedAt: string;
  lastSeenAt: string;
};

/** GET /api/session: who this browser is, and which server it talks to. */
export type SessionResponse = {
  device: Device;
  server: { name: string; version: string };
};

/**
 * Errors: `NOT_PAIRED` (no or unknown token), `DEVICE_REVOKED`, `PAIRING_LINK_EXPIRED`,
 * `PAIRING_LINK_USED`.
 */
export type ConnectionErrorCode =
  | 'NOT_PAIRED'
  | 'DEVICE_REVOKED'
  | 'PAIRING_LINK_EXPIRED'
  | 'PAIRING_LINK_USED';
