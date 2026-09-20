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

/** Where this server answers, as the bound listener reports it. */
export type PairingReach = { port: number; policy: HostPolicy };

/** A pairing link is good for fifteen minutes and one redemption. */
const GRANT_LIFETIME_MS = 15 * 60 * 1000;

export class Pairing {
  private readonly store: PairingStore;
  private readonly directory: DeviceRegistry;
  private readonly inventory: InventoryStore;
  /** Where this server answers: the same rule the request hook applies. */
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

  /**
   * Issue one link per label. The owner's flow is several devices at once, so
   * this takes a list rather than making them run the command repeatedly.
   */
  issue(
    labels: readonly string[],
    addresses: readonly string[],
  ): IssuedGrant[] {
    // A link with no address is not a link, and one aimed somewhere this server
    // does not answer hands the fragment to whoever is there instead.
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
      // The environment id travels with the code so a client can refuse a link
      // meant for another installation before it sends the secret anywhere.
      const fragment = new URLSearchParams({ c: token, e: environmentId });
      if (addresses.length > 1) fragment.set('a', addresses.join(','));
      return {
        grant: { id, label, addresses: [...addresses], createdAt, expiresAt },
        code: token,
        // The code rides in the fragment: browsers never send a fragment, so it
        // stays out of the request line, access logs and Referer headers.
        link: `${target}/pair#${fragment.toString()}`,
      };
    });
  }

  /**
   * Whether a link may point here. The host is judged by the same rule the
   * request hook uses, so `--lan` cannot accept a request at an address that
   * pairing then rejects. The port must be the one bound, because a link is a
   * promise that the device can reach this server — the hook has no such job
   * and so does not check it.
   */
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

  /** Revoke a pending grant or a paired device; the owner has one id to hand. */
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
