import { IssuePairingOptions } from '../ports/issue-pairing-options.ts';
import { Effect, Context, Layer, Clock, DateTime } from 'effect';
import { IdSource, SecretSource } from '@porcelain/kernel/ports';
import { instantAfter, sha256Hex } from '@porcelain/kernel/rules';
import { InvalidDeviceDetailsError } from '../errors/invalid-device-details-error.ts';
import { InvalidPairingAddressError } from '../errors/invalid-pairing-address-error.ts';
import type {
  IssuedPairingGrant,
  IssuePairingInput,
  IssuePairingResult,
} from '../models/issue-pairing.ts';
import type { PairingGrant } from '../models/pairing-grant.ts';
import { PairingGrantStore } from '../ports/pairing-grant-store.ts';
import { PairingReachReader } from '../ports/pairing-reach-reader.ts';
import { credential } from '../rules/credential.ts';
import { validLabel } from '../rules/device-details.ts';
import { pairingAddressReachable } from '../rules/host-policy.ts';

export class IssuePairingService extends Context.Service<
  IssuePairingService,
  {
    readonly execute: (
      input: IssuePairingInput,
    ) => Effect.Effect<
      IssuePairingResult,
      InvalidPairingAddressError | InvalidDeviceDetailsError
    >;
  }
>()('@porcelain/access/IssuePairingService') {
  static readonly layer = Layer.effect(
    IssuePairingService,
    Effect.gen(function* () {
      const pairingGrants = yield* PairingGrantStore;
      const pairingReachReader = yield* PairingReachReader;
      const clock = yield* Clock.Clock;
      const idSource = yield* IdSource;
      const secretSource = yield* SecretSource;
      const options = yield* IssuePairingOptions;
      const operationDetail = Effect.fn('IssuePairingService.operationDetail')(
        function* (
          value: string | undefined,
        ): Effect.fn.Return<string, InvalidDeviceDetailsError> {
          if (value === undefined)
            return yield* Effect.fail(new InvalidDeviceDetailsError());
          return value;
        },
      );
      function operationIssued(
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
      return {
        execute: Effect.fn('IssuePairingService.execute')(function* (
          input: IssuePairingInput,
        ): Effect.fn.Return<
          IssuePairingResult,
          InvalidPairingAddressError | InvalidDeviceDetailsError
        > {
          const reach = pairingReachReader.current();
          if (
            !input.addresses.every((address) =>
              pairingAddressReachable(address, reach),
            )
          )
            return yield* Effect.fail(new InvalidPairingAddressError());
          const labels = yield* Effect.forEach(input.labels, (label) =>
            operationDetail(validLabel(label, options.labelLength)),
          );
          const trusted = input.trusted === true;
          const createdAt = DateTime.formatIso(
            DateTime.makeUnsafe(yield* clock.currentTimeMillis),
          );
          const expiresAt = instantAfter(createdAt, options.lifetimeMs);
          const issued = labels.map((label) => {
            const code = credential(
              'pcp',
              idSource.next(),
              secretSource.next(),
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
          yield* pairingGrants.add({
            grants: issued.map(({ grant, code }) => ({
              ...grant,
              secretHash: sha256Hex(code.secret),
            })),
          });
          return {
            grants: issued.map(({ grant, code }) =>
              operationIssued(grant, code.token, input.environmentId),
            ),
          };
        }),
      };
    }),
  );
}
