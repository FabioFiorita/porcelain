import type { Clock, IdSource } from '@porcelain/kernel/ports';
import { InvalidPairingAddressError } from '../errors/invalid-pairing-address-error.ts';
import type {
  IssuePairingInput,
  IssuePairingResult,
} from '../models/issue-pairing.ts';
import type { PairingGrantStore } from '../ports/pairing-grant-store.ts';
import type { PairingReachReader } from '../ports/pairing-reach-reader.ts';
import { hashSecret, mintCredential } from '../rules/credential.ts';
import { checkedLabel } from '../rules/device-details.ts';
import { pairingAddressReachable } from '../rules/host-policy.ts';
import { pairingGrantExpiry } from '../rules/pairing-grant.ts';

export class IssuePairingService {
  private readonly pairingGrantStore: PairingGrantStore;
  private readonly pairingReachReader: PairingReachReader;
  private readonly clock: Clock;
  private readonly idSource: IdSource;

  constructor(
    pairingGrantStore: PairingGrantStore,
    pairingReachReader: PairingReachReader,
    clock: Clock,
    idSource: IdSource,
  ) {
    this.pairingGrantStore = pairingGrantStore;
    this.pairingReachReader = pairingReachReader;
    this.clock = clock;
    this.idSource = idSource;
  }

  execute(input: IssuePairingInput): IssuePairingResult {
    const reach = this.pairingReachReader.current();
    if (
      !input.addresses.every((address) =>
        pairingAddressReachable(address, reach),
      )
    )
      throw new InvalidPairingAddressError();
    const labels = input.labels.map((label) => checkedLabel(label));
    const createdAt = this.clock.now();
    const expiresAt = pairingGrantExpiry(createdAt);
    const issued = labels.map((label) => {
      const credential = mintCredential('pcp', this.idSource.next());
      const grant = {
        id: credential.id,
        label,
        addresses: [...input.addresses],
        createdAt,
        expiresAt,
      };
      return { grant, credential };
    });
    this.pairingGrantStore.add(
      issued.map(({ grant, credential }) => ({
        ...grant,
        secretHash: hashSecret(credential.secret),
      })),
    );
    return {
      grants: issued.map(({ grant, credential }) => ({
        grant,
        code: credential.token,
      })),
    };
  }
}
