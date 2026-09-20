import type { Inventory } from '../../domain/inventory';

/** What a pairing link carries, once the fragment has been read and erased. */
export type PairingCode = { code: string; environmentId: string };

export type PairingPort = {
  /**
   * Redeem a pairing code for this browser. The credential never reaches
   * script: the server returns it as an HttpOnly cookie, so success is the
   * inventory it answers with.
   */
  redeem(request: PairingCode & { signal: AbortSignal }): Promise<Inventory>;
};
