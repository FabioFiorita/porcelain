import type { Clock } from '@porcelain/kernel/ports';
import type {
  RevokePairingGrantInput,
  RevokePairingGrantResult,
} from '../models/revoke-pairing-grant.ts';
import type { PairingGrantStore } from '../ports/pairing-grant-store.ts';
import { pairingGrantRevocable } from '../rules/pairing-grant.ts';

export class RevokePairingGrantService {
  private readonly pairingGrants: PairingGrantStore;
  private readonly clock: Clock;

  constructor(pairingGrants: PairingGrantStore, clock: Clock) {
    this.pairingGrants = pairingGrants;
    this.clock = clock;
  }

  execute(input: RevokePairingGrantInput): RevokePairingGrantResult {
    const grant = this.pairingGrants.find({ grantId: input.id });
    if (!grant || !pairingGrantRevocable(grant)) return { kind: 'not-revoked' };
    this.pairingGrants.markRevoked({ grant, revokedAt: this.clock.now() });
    return { kind: 'revoked' };
  }
}
