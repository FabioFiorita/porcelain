import type {
  PairingRedemption,
  StoredPairingGrant,
} from '../../src/models/pairing-grant.ts';
import type { PairingGrantStore } from '../../src/ports/pairing-grant-store.ts';
import { InMemoryDeviceStore } from './in-memory-device-store.ts';

export class InMemoryPairingGrantStore implements PairingGrantStore {
  private readonly grants = new Map<string, StoredPairingGrant>();
  private readonly revocations = new Map<string, string>();
  private readonly redemptions = new Map<string, string>();
  private readonly devices: InMemoryDeviceStore;

  constructor(devices = new InMemoryDeviceStore()) {
    this.devices = devices;
  }

  add(input: { grants: readonly StoredPairingGrant[] }): void {
    input.grants.forEach((grant) => {
      this.grants.set(grant.id, structuredClone(grant));
      this.revocations.delete(grant.id);
      this.redemptions.delete(grant.id);
    });
  }

  find(input: { grantId: string }): StoredPairingGrant | undefined {
    const grant = this.grants.get(input.grantId);
    return grant && this.current(grant);
  }

  list(): StoredPairingGrant[] {
    return [...this.grants.values()]
      .map((grant) => this.current(grant))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  markRevoked(input: { grant: StoredPairingGrant; revokedAt: string }): void {
    this.revocations.set(input.grant.id, input.revokedAt);
  }

  redeem(input: PairingRedemption): void {
    this.redemptions.set(input.grant.id, input.redeemedAt);
    this.devices.add(input.device);
  }

  private current(grant: StoredPairingGrant): StoredPairingGrant {
    return {
      ...structuredClone(grant),
      revokedAt: this.revocations.get(grant.id) ?? grant.revokedAt,
      redeemedAt: this.redemptions.get(grant.id) ?? grant.redeemedAt,
    };
  }
}
