import { Effect, Context, Layer } from 'effect';
import type { EnvironmentName } from '../models/environment-name.ts';
import { EnvironmentNameStore } from '../ports/environment-name-store.ts';
import { HostNameReader } from '../ports/host-name-reader.ts';
import { environmentName } from '../rules/environment-name.ts';

export class ReadEnvironmentNameService extends Context.Service<
  ReadEnvironmentNameService,
  { readonly execute: () => Effect.Effect<EnvironmentName, never> }
>()('@porcelain/access/ReadEnvironmentNameService') {
  static readonly layer = Layer.effect(
    ReadEnvironmentNameService,
    Effect.gen(function* () {
      const names = yield* EnvironmentNameStore;
      const hostNames = yield* HostNameReader;

      return {
        execute: Effect.fn('ReadEnvironmentNameService.execute')(
          function* (): Effect.fn.Return<EnvironmentName, never> {
            return environmentName(yield* names.read(), hostNames.hostName());
          },
        ),
      };
    }),
  );
}
