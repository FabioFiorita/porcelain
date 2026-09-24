import type { Clock } from '@porcelain/kernel/ports';
import type {
  RevokeAccessInput,
  RevokeAccessResult,
} from '../models/revoke-access.ts';
import type { PairingGrantStore } from '../ports/pairing-grant-store.ts';
import { pairingGrantRevocable } from '../rules/pairing-grant.ts';

export class RevokePairingGrantService {
  private readonly pairingGrantStore: PairingGrantStore;
  private readonly clock: Clock;

  constructor(pairingGrantStore: PairingGrantStore, clock: Clock) {
    this.pairingGrantStore = pairingGrantStore;
    this.clock = clock;
  }

  execute(input: RevokeAccessInput): RevokeAccessResult {
    const grant = this.pairingGrantStore.find(input.id);
    if (!grant || !pairingGrantRevocable(grant)) return { revoked: false };
    this.pairingGrantStore.markRevoked(grant.id, this.clock.now());
    return { revoked: true, kind: 'grant' };
  }
}
