import { Effect, Context, Layer } from 'effect';
import type {
  IdentifyRequestClientInput,
  RequestClient,
} from '../models/identify-request-client.ts';
import { RemoteAccessStore } from '../ports/remote-access-store.ts';
import { RouteStateStore } from '../ports/route-state-store.ts';
import { answeredTunnelHosts } from '../rules/remote-access.ts';
import { requestClient } from '../rules/request-client.ts';

export class IdentifyRequestClientService extends Context.Service<
  IdentifyRequestClientService,
  {
    readonly execute: (
      input: IdentifyRequestClientInput,
    ) => Effect.Effect<RequestClient, never>;
  }
>()('@porcelain/access/IdentifyRequestClientService') {
  static readonly layer = Layer.effect(
    IdentifyRequestClientService,
    Effect.gen(function* () {
      const remoteAccess = yield* RemoteAccessStore;
      const routeStates = yield* RouteStateStore;

      return {
        execute: Effect.fn('IdentifyRequestClientService.execute')(function* (
          input: IdentifyRequestClientInput,
        ): Effect.fn.Return<RequestClient, never> {
          return yield* Effect.sync<RequestClient>(() => {
            const routes = routeStates.read();
            return requestClient(
              input,
              answeredTunnelHosts(remoteAccess.read(), routes.states),
              routes.tailnetProxy,
            );
          });
        }),
      };
    }),
  );
}
