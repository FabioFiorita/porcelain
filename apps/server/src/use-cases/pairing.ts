import {
  hashSecret,
  mintCredential,
  parseCredential,
} from '../models/credential.ts';
import {
  canonicalHostname,
  type HostPolicy,
  reachableAt,
} from '../models/origin-policy.ts';
import type {
  AccessListing,
  DeviceRegistration,
  IssuedGrant,
  RedeemedPairing,
} from '../models/pairing.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import type {
  DeviceRegistry,
  PairingStore,
} from '../repositories/interfaces/pairing-store.ts';
import { checkedLabel, checkedPlatform } from './device-details.ts';
import { InvalidPairingAddressError } from './errors/invalid-pairing-address-error.ts';
import { InvalidPairingError } from './errors/invalid-pairing-error.ts';

export type PairingReach = { port: number; policy: HostPolicy };

const GRANT_LIFETIME_MS = 15 * 60 * 1000;

export class Pairing {
  private readonly store: PairingStore;
  private readonly directory: DeviceRegistry;
  private readonly inventory: InventoryStore;
  private readonly reachable: () => PairingReach;
  private readonly now: () => number;

  constructor(
    store: PairingStore,
    directory: DeviceRegistry,
    inventory: InventoryStore,
    reachable: () => PairingReach,
    now: () => number = Date.now,
  ) {
    this.store = store;
    this.directory = directory;
    this.inventory = inventory;
    this.reachable = reachable;
    this.now = now;
  }

  issue(
    labels: readonly string[],
    addresses: readonly string[],
  ): IssuedGrant[] {
    if (addresses.length === 0) throw new InvalidPairingAddressError('none');
    const reach = this.reachable();
    for (const address of addresses)
      if (!this.answersAt(address, reach))
        throw new InvalidPairingAddressError(address);
    const environmentId = this.inventory.read().environmentId;
    const at = this.now();
    return labels.map((raw) => {
      const label = checkedLabel(raw);
      const { id, secret, token } = mintCredential('pcp');
      const createdAt = new Date(at).toISOString();
      const expiresAt = new Date(at + GRANT_LIFETIME_MS).toISOString();
      this.store.issueGrant({
        id,
        label,
        secretHash: hashSecret(secret),
        addresses: [...addresses],
        createdAt,
        expiresAt,
      });
      const target = addresses[0] ?? '';
      const fragment = new URLSearchParams({ c: token, e: environmentId });
      if (addresses.length > 1) fragment.set('a', addresses.join(','));
      return {
        grant: { id, label, addresses: [...addresses], createdAt, expiresAt },
        code: token,
        link: `${target}/pair#${fragment.toString()}`,
      };
    });
  }

  private answersAt(address: string, reach: PairingReach): boolean {
    let url: URL;
    try {
      url = new URL(address);
    } catch {
      return false;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    const port =
      url.port === '' ? (url.protocol === 'http:' ? '80' : '443') : url.port;
    if (port !== String(reach.port)) return false;
    const hostname = canonicalHostname(url.hostname);
    return hostname !== null && reachableAt(hostname, reach.policy);
  }

  listing(): AccessListing {
    return {
      grants: this.store.listGrants(new Date(this.now()).toISOString()),
      devices: this.store.listDevices(),
    };
  }

  revoke(id: string): { revoked: boolean; kind: 'grant' | 'device' | null } {
    const at = new Date(this.now()).toISOString();
    if (this.store.revokeGrant(id, at)) return { revoked: true, kind: 'grant' };
    if (this.directory.revoke(id, at)) return { revoked: true, kind: 'device' };
    return { revoked: false, kind: null };
  }

  redeem(code: string, registration: DeviceRegistration): RedeemedPairing {
    const parsed = parseCredential('pcp', code);
    if (!parsed) throw new InvalidPairingError();
    const at = this.now();
    const credential = mintCredential('pcd');
    const device = this.store.redeem({
      grantId: parsed.id,
      secret: parsed.secret,
      now: new Date(at).toISOString(),
      device: {
        id: credential.id,
        label: registration.label ? checkedLabel(registration.label) : '',
        platform: checkedPlatform(registration.platform),
        secretHash: hashSecret(credential.secret),
        createdAt: new Date(at).toISOString(),
      },
    });
    if (!device) throw new InvalidPairingError();
    this.directory.add({
      ...device,
      secretHash: hashSecret(credential.secret),
      revokedAt: null,
    });
    return { device, credential: credential.token };
  }
}
