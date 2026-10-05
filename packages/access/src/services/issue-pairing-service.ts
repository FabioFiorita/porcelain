import { Effect } from 'effect';
import type { Clock, IdSource, SecretSource } from '@porcelain/kernel/ports';
import { instantAfter, sha256Hex } from '@porcelain/kernel/rules';
import { InvalidDeviceDetailsError } from '../errors/invalid-device-details-error.ts';
import { InvalidPairingAddressError } from '../errors/invalid-pairing-address-error.ts';
import type {
  IssuedPairingGrant,
  IssuePairingInput,
  IssuePairingOptions,
  IssuePairingResult,
} from '../models/issue-pairing.ts';
import type { PairingGrant } from '../models/pairing-grant.ts';
import type { PairingGrantStore } from '../ports/pairing-grant-store.ts';
import type { PairingReachReader } from '../ports/pairing-reach-reader.ts';
import { credential } from '../rules/credential.ts';
import { validLabel } from '../rules/device-details.ts';
import { pairingAddressReachable } from '../rules/host-policy.ts';

export class IssuePairingService {
  private readonly pairingGrants: PairingGrantStore;
  private readonly pairingReachReader: PairingReachReader;
  private readonly clock: Clock;
  private readonly idSource: IdSource;
  private readonly secretSource: SecretSource;
  private readonly options: IssuePairingOptions;

  constructor(
    pairingGrants: PairingGrantStore,
    pairingReachReader: PairingReachReader,
    clock: Clock,
    idSource: IdSource,
    secretSource: SecretSource,
    options: IssuePairingOptions,
  ) {
    this.pairingGrants = pairingGrants;
    this.pairingReachReader = pairingReachReader;
    this.clock = clock;
    this.idSource = idSource;
    this.secretSource = secretSource;
    this.options = options;
  }

  execute(
    input: IssuePairingInput,
  ): Effect.Effect<
    IssuePairingResult,
    InvalidPairingAddressError | InvalidDeviceDetailsError
  > {
    return Effect.gen({ self: this }, function* () {
      const reach = this.pairingReachReader.current();
      if (
        !input.addresses.every((address) =>
          pairingAddressReachable(address, reach),
        )
      )
        return yield* Effect.fail(new InvalidPairingAddressError());
      const labels = yield* Effect.forEach(input.labels, (label) =>
        this.detail(validLabel(label, this.options.labelLength)),
      );
      const trusted = input.trusted === true;
      const createdAt = this.clock.now();
      const expiresAt = instantAfter(createdAt, this.options.lifetimeMs);
      const issued = labels.map((label) => {
        const code = credential(
          'pcp',
          this.idSource.next(),
          this.secretSource.next(),
        );
        const grant = {
          id: code.id,
          label,
          addresses: [...input.addresses],
          createdAt,
          expiresAt,
          trusted,
        };
        return { grant, code };
      });
      this.pairingGrants.add({
        grants: issued.map(({ grant, code }) => ({
          ...grant,
          secretHash: sha256Hex(code.secret),
        })),
      });
      return {
        grants: issued.map(({ grant, code }) =>
          this.issued(grant, code.token, input.environmentId),
        ),
      };
    });
  }

  private detail(
    value: string | undefined,
  ): Effect.Effect<string, InvalidDeviceDetailsError> {
    return Effect.gen({ self: this }, function* () {
      if (value === undefined)
        return yield* Effect.fail(new InvalidDeviceDetailsError());
      return value;
    });
  }

  private issued(
    grant: PairingGrant & { trusted: boolean },
    code: string,
    environmentId: string,
  ): IssuedPairingGrant {
    return {
      grant,
      code,
      link: { addresses: [...grant.addresses], code, environmentId },
    };
  }
}
