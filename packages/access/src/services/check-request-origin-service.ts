import { Effect, Context, Layer } from 'effect';
import type {
  CheckRequestOriginInput,
  CheckRequestOriginResult,
} from '../models/check-request-origin.ts';
import { RemoteAccessStore } from '../ports/remote-access-store.ts';
import { RouteStateStore } from '../ports/route-state-store.ts';
import { httpsHosts } from '../rules/remote-access.ts';
import { requestOriginCheck } from '../rules/request-origin-check.ts';

export class CheckRequestOriginService extends Context.Service<
  CheckRequestOriginService,
  {
    readonly execute: (
      input: CheckRequestOriginInput,
    ) => Effect.Effect<CheckRequestOriginResult, never>;
  }
>()('@porcelain/access/CheckRequestOriginService') {
  static readonly layer = Layer.effect(
    CheckRequestOriginService,
    Effect.gen(function* () {
      const remoteAccess = yield* RemoteAccessStore;
      const routeStates = yield* RouteStateStore;

      return {
        execute: Effect.fn('CheckRequestOriginService.execute')(function* (
          input: CheckRequestOriginInput,
        ): Effect.fn.Return<CheckRequestOriginResult, never> {
          return requestOriginCheck(
            input,
            httpsHosts(yield* remoteAccess.read(), routeStates.read(), input),
          );
        }),
      };
    }),
  );
}
