import { hashSecret, mintCredential } from '../models/credential.ts';
import { checkedLabel } from '../models/device-details.ts';
import { canonicalHostname, reachableAt } from '../models/origin-policy.ts';
import type { IssuedGrant } from '../models/pairing.ts';
import { InvalidPairingAddressError } from '../errors/invalid-pairing-address-error.ts';
import type { EnvironmentIdentityStore } from '../ports/environment-identity-store.ts';
import type { PairingGrantStore } from '../ports/pairing-grant-store.ts';
import type { PairingReach, PairingReachPort } from '../ports/pairing-reach.ts';

const GRANT_LIFETIME_MS = 15 * 60 * 1000;

export class IssuePairingService {
  private readonly grants: PairingGrantStore;
  private readonly environment: EnvironmentIdentityStore;
  private readonly reach: PairingReachPort;
  private readonly now: () => number;

  constructor(
    grants: PairingGrantStore,
    environment: EnvironmentIdentityStore,
    reach: PairingReachPort,
    now: () => number = Date.now,
  ) {
    this.grants = grants;
    this.environment = environment;
    this.reach = reach;
    this.now = now;
  }

  execute(
    labels: readonly string[],
    addresses: readonly string[],
  ): IssuedGrant[] {
    if (addresses.length === 0) throw new InvalidPairingAddressError('none');
    const reach = this.reach.current();
    for (const address of addresses)
      if (!this.answersAt(address, reach))
        throw new InvalidPairingAddressError(address);
    const environmentId = this.environment.environmentId();
    const at = this.now();
    return labels.map((raw) => {
      const label = checkedLabel(raw);
      const { id, secret, token } = mintCredential('pcp');
      const createdAt = new Date(at).toISOString();
      const expiresAt = new Date(at + GRANT_LIFETIME_MS).toISOString();
      this.grants.issueGrant({
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
    return hostname !== undefined && reachableAt(hostname, reach.policy);
  }
}
