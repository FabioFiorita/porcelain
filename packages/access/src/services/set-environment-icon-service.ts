import { Effect, Context, Layer } from 'effect';
import type {
  ChosenEnvironmentLabel,
  EnvironmentLabel,
} from '../models/environment-label.ts';
import { EnvironmentLabelStore } from '../ports/environment-label-store.ts';
import { HostNameReader } from '../ports/host-name-reader.ts';
import { environmentLabel } from '../rules/environment-label.ts';

export class SetEnvironmentIconService extends Context.Service<
  SetEnvironmentIconService,
  {
    readonly execute: (
      input: Pick<ChosenEnvironmentLabel, 'icon'>,
    ) => Effect.Effect<EnvironmentLabel, never>;
  }
>()('@porcelain/access/SetEnvironmentIconService') {
  static readonly layer = Layer.effect(
    SetEnvironmentIconService,
    Effect.gen(function* () {
      const labels = yield* EnvironmentLabelStore;
      const hostNames = yield* HostNameReader;

      return {
        execute: Effect.fn('SetEnvironmentIconService.execute')(function* (
          input: Pick<ChosenEnvironmentLabel, 'icon'>,
        ): Effect.fn.Return<EnvironmentLabel, never> {
          const chosen = { ...(yield* labels.read()), icon: input.icon };
          yield* labels.save(chosen);
          return environmentLabel(chosen, hostNames.hostName());
        }),
      };
    }),
  );
}
