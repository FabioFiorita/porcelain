import { Effect, Context, Layer } from 'effect';
import { Clock } from '@porcelain/kernel/ports';
import type {
  ListAccessInput,
  ListAccessResult,
} from '../models/list-access.ts';
import { DeviceStore } from '../ports/device-store.ts';
import { PairingGrantStore } from '../ports/pairing-grant-store.ts';
import { deviceRevoked } from '../rules/device-activity.ts';
import { pairingGrantPending } from '../rules/pairing-grant.ts';

export class ListAccessService extends Context.Service<
  ListAccessService,
  {
    readonly execute: (
      input?: ListAccessInput,
    ) => Effect.Effect<ListAccessResult, never>;
  }
>()('@porcelain/access/ListAccessService') {
  static readonly layer = Layer.effect(
    ListAccessService,
    Effect.gen(function* () {
      const pairingGrants = yield* PairingGrantStore;
      const devices = yield* DeviceStore;
      const clock = yield* Clock;

      return {
        execute: Effect.fn('ListAccessService.execute')(function* (
          input?: ListAccessInput,
        ): Effect.fn.Return<ListAccessResult, never> {
          const now = clock.now();
          return {
            grants: (yield* pairingGrants.list())
              .filter((grant) => pairingGrantPending(grant, now))
              .map(
                ({ id, label, addresses, createdAt, expiresAt, trusted }) => ({
                  id,
                  label,
                  addresses,
                  createdAt,
                  expiresAt,
                  trusted: trusted === true,
                }),
              ),
            devices: (yield* devices.list())
              .filter((device) => !deviceRevoked(device))
              .map(
                ({
                  id,
                  label,
                  platform,
                  createdAt,
                  lastSeenAt,
                  lastSeenAddress,
                  route,
                  routeInferred,
                  trusted,
                }) => ({
                  id,
                  label,
                  platform,
                  createdAt,
                  lastSeenAt,
                  ...(lastSeenAddress === undefined ? {} : { lastSeenAddress }),
                  route,
                  ...(routeInferred === true ? { routeInferred } : {}),
                  trusted: trusted === true,
                  ...(id === input?.viewerDeviceId ? { current: true } : {}),
                }),
              ),
          };
        }),
      };
    }),
  );
}
