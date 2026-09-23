import type {
  PairingRedemption,
  StoredPairingGrant,
} from '../../src/models/pairing-grant.ts';
import type { PairingGrantStore } from '../../src/ports/pairing-grant-store.ts';
import { InMemoryDeviceStore } from './in-memory-device-store.ts';

export class InMemoryPairingGrantStore implements PairingGrantStore {
  readonly grants = new Map<string, StoredPairingGrant>();
  readonly deviceStore: InMemoryDeviceStore;

  constructor(deviceStore = new InMemoryDeviceStore()) {
    this.deviceStore = deviceStore;
  }

  add(grants: readonly StoredPairingGrant[]): void {
    for (const grant of grants) {
      if (this.grants.has(grant.id))
        throw new Error(`Grant ${grant.id} already exists`);
      this.grants.set(grant.id, { ...grant, addresses: [...grant.addresses] });
    }
  }

  find(grantId: string): StoredPairingGrant | undefined {
    const grant = this.grants.get(grantId);
    return grant ? { ...grant } : undefined;
  }

  list(): StoredPairingGrant[] {
    return [...this.grants.values()]
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map((grant) => ({ ...grant }));
  }

  markRevoked(grantId: string, revokedAt: string): void {
    const grant = this.grants.get(grantId);
    if (grant) this.grants.set(grantId, { ...grant, revokedAt });
  }

  redeem(redemption: PairingRedemption): void {
    const grant = this.grants.get(redemption.grantId);
    if (!grant) throw new Error(`Grant ${redemption.grantId} does not exist`);
    this.deviceStore.add(redemption.device);
    this.grants.set(grant.id, { ...grant, redeemedAt: redemption.redeemedAt });
  }
}
