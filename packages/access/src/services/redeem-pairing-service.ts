import { RedeemPairingOptions } from '../ports/redeem-pairing-options.ts';
import { Effect, Context, Layer } from 'effect';
import { Clock, IdSource, SecretSource } from '@porcelain/kernel/ports';
import { sha256Hex } from '@porcelain/kernel/rules';
import { InvalidDeviceDetailsError } from '../errors/invalid-device-details-error.ts';
import { InvalidPairingError } from '../errors/invalid-pairing-error.ts';
import type { Device } from '../models/device.ts';
import type {
  RedeemPairingInput,
  RedeemPairingResult,
} from '../models/redeem-pairing.ts';
import { PairingGrantStore } from '../ports/pairing-grant-store.ts';
import {
  credential,
  parseCredential,
  secretMatches,
} from '../rules/credential.ts';
import { validLabel, validPlatform } from '../rules/device-details.ts';
import { pairingGrantRedeemable } from '../rules/pairing-grant.ts';

export class RedeemPairingService extends Context.Service<
  RedeemPairingService,
  {
    readonly execute: (
      input: RedeemPairingInput,
    ) => Effect.Effect<
      RedeemPairingResult,
      InvalidPairingError | InvalidDeviceDetailsError
    >;
  }
>()('@porcelain/access/RedeemPairingService') {
  static readonly layer = Layer.effect(
    RedeemPairingService,
    Effect.gen(function* () {
      const pairingGrants = yield* PairingGrantStore;
      const clock = yield* Clock;
      const idSource = yield* IdSource;
      const secretSource = yield* SecretSource;
      const options = yield* RedeemPairingOptions;
      const operationDetail = Effect.fn('RedeemPairingService.operationDetail')(
        function* (
          value: string | undefined,
        ): Effect.fn.Return<string, InvalidDeviceDetailsError> {
          if (value === undefined)
            return yield* Effect.fail(new InvalidDeviceDetailsError());
          return value;
        },
      );
      return {
        execute: Effect.fn('RedeemPairingService.execute')(function* (
          input: RedeemPairingInput,
        ): Effect.fn.Return<
          RedeemPairingResult,
          InvalidPairingError | InvalidDeviceDetailsError
        > {
          const code = parseCredential('pcp', input.code);
          if (!code) return yield* Effect.fail(new InvalidPairingError());
          const label =
            input.label === undefined
              ? undefined
              : yield* operationDetail(
                  validLabel(input.label, options.labelLength),
                );
          const platform = yield* operationDetail(
            validPlatform(input.platform, options.platformLength),
          );
          const now = clock.now();
          const grant = yield* pairingGrants.find({ grantId: code.id });
          if (
            !grant ||
            !secretMatches(grant.secretHash, code.secret) ||
            !pairingGrantRedeemable(grant, now)
          )
            return yield* Effect.fail(new InvalidPairingError());
          const issued = credential(
            'pcd',
            idSource.next(),
            secretSource.next(),
          );
          const device: Device = {
            id: issued.id,
            label: label ?? grant.label,
            platform,
            createdAt: now,
            lastSeenAt: now,
            route: input.route,
            ...(grant.trusted === true ? { trusted: true } : {}),
          };
          yield* pairingGrants.redeem({
            grant,
            redeemedAt: now,
            device: { ...device, secretHash: sha256Hex(issued.secret) },
          });
          return { device, credential: issued.token };
        }),
      };
    }),
  );
}
