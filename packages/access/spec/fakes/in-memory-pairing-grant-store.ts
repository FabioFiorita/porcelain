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
    input.grants.forEach((grant) =>
      this.grants.set(grant.id, structuredClone(grant)),
    );
  }

  find(input: { grantId: string }): StoredPairingGrant | undefined {
    return structuredClone(this.grants.get(input.grantId));
  }

  list(): StoredPairingGrant[] {
    return [...this.grants.values()]
      .map((grant) => structuredClone(grant))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  markRevoked(input: { grant: StoredPairingGrant; revokedAt: string }): void {
    this.change(input.grant.id, (stored) => ({
      ...stored,
      revokedAt: input.revokedAt,
    }));
  }

  redeem(input: PairingRedemption): void {
    this.change(input.grant.id, (stored) => ({
      ...stored,
      redeemedAt: input.redeemedAt,
    }));
    this.devices.add(input.device);
  }

  private change(
    grantId: string,
    update: (stored: StoredPairingGrant) => StoredPairingGrant,
  ): void {
    [this.grants.get(grantId)]
      .filter((stored) => stored !== undefined)
      .forEach((stored) => this.grants.set(grantId, update(stored)));
  }
}
