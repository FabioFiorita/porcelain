import { Effect, Context, Layer } from 'effect';
import type {
  ChosenEnvironmentName,
  EnvironmentName,
} from '../models/environment-name.ts';
import { EnvironmentNameStore } from '../ports/environment-name-store.ts';
import { HostNameReader } from '../ports/host-name-reader.ts';
import { environmentName } from '../rules/environment-name.ts';

export class RenameEnvironmentService extends Context.Service<
  RenameEnvironmentService,
  {
    readonly execute: (
      input: ChosenEnvironmentName,
    ) => Effect.Effect<EnvironmentName, never>;
  }
>()('@porcelain/access/RenameEnvironmentService') {
  static readonly layer = Layer.effect(
    RenameEnvironmentService,
    Effect.gen(function* () {
      const names = yield* EnvironmentNameStore;
      const hostNames = yield* HostNameReader;

      return {
        execute: Effect.fn('RenameEnvironmentService.execute')(function* (
          input: ChosenEnvironmentName,
        ): Effect.fn.Return<EnvironmentName, never> {
          yield* names.save(input);
          return environmentName(input, hostNames.hostName());
        }),
      };
    }),
  );
}
