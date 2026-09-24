import type {
  PairingRedemption,
  StoredPairingGrant,
} from '../../src/models/pairing-grant.ts';
import type { PairingGrantStore } from '../../src/ports/pairing-grant-store.ts';
import { InMemoryDeviceStore } from './in-memory-device-store.ts';

export class InMemoryPairingGrantStore implements PairingGrantStore {
  private readonly grants = new Map<string, StoredPairingGrant>();
  private readonly devices: InMemoryDeviceStore;

  constructor(devices = new InMemoryDeviceStore()) {
    this.devices = devices;
  }

  add(input: { grants: readonly StoredPairingGrant[] }): void {
    input.grants.forEach((grant) => this.grants.set(grant.id, grant));
  }

  find(input: { grantId: string }): StoredPairingGrant | undefined {
    return this.grants.get(input.grantId);
  }

  list(): StoredPairingGrant[] {
    return [...this.grants.values()];
  }

  markRevoked(input: { grant: StoredPairingGrant; revokedAt: string }): void {
    this.grants.set(input.grant.id, {
      ...input.grant,
      revokedAt: input.revokedAt,
    });
  }

  redeem(input: PairingRedemption): void {
    this.grants.set(input.grant.id, {
      ...input.grant,
      redeemedAt: input.redeemedAt,
    });
    this.devices.add(input.device);
  }
}
