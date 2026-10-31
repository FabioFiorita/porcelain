import { Effect, Context, Layer } from 'effect';
import type {
  ChosenEnvironmentLabel,
  EnvironmentLabel,
} from '../models/environment-label.ts';
import { EnvironmentLabelStore } from '../ports/environment-label-store.ts';
import { HostNameReader } from '../ports/host-name-reader.ts';
import { environmentLabel } from '../rules/environment-label.ts';

export class RenameEnvironmentService extends Context.Service<
  RenameEnvironmentService,
  {
    readonly execute: (
      input: Pick<ChosenEnvironmentLabel, 'name'>,
    ) => Effect.Effect<EnvironmentLabel, never>;
  }
>()('@porcelain/access/RenameEnvironmentService') {
  static readonly layer = Layer.effect(
    RenameEnvironmentService,
    Effect.gen(function* () {
      const labels = yield* EnvironmentLabelStore;
      const hostNames = yield* HostNameReader;

      return {
        execute: Effect.fn('RenameEnvironmentService.execute')(function* (
          input: Pick<ChosenEnvironmentLabel, 'name'>,
        ): Effect.fn.Return<EnvironmentLabel, never> {
          const chosen = { ...(yield* labels.read()), name: input.name };
          yield* labels.save(chosen);
          return environmentLabel(chosen, hostNames.hostName());
        }),
      };
    }),
  );
}
