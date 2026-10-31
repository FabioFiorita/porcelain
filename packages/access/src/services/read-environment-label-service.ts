import { Effect, Context, Layer } from 'effect';
import type { EnvironmentLabel } from '../models/environment-label.ts';
import { EnvironmentLabelStore } from '../ports/environment-label-store.ts';
import { HostNameReader } from '../ports/host-name-reader.ts';
import { environmentLabel } from '../rules/environment-label.ts';

export class ReadEnvironmentLabelService extends Context.Service<
  ReadEnvironmentLabelService,
  { readonly execute: () => Effect.Effect<EnvironmentLabel, never> }
>()('@porcelain/access/ReadEnvironmentLabelService') {
  static readonly layer = Layer.effect(
    ReadEnvironmentLabelService,
    Effect.gen(function* () {
      const labels = yield* EnvironmentLabelStore;
      const hostNames = yield* HostNameReader;

      return {
        execute: Effect.fn('ReadEnvironmentLabelService.execute')(
          function* (): Effect.fn.Return<EnvironmentLabel, never> {
            return environmentLabel(yield* labels.read(), hostNames.hostName());
          },
        ),
      };
    }),
  );
}
