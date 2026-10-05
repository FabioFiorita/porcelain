import { ServiceUpdateCheckOptions } from '../ports/service-update-check-options.ts';
import { Effect, Context, Layer } from 'effect';
import { Clock } from '@porcelain/kernel/ports';
import type { ServiceUpdateCheck } from '../models/service-update.ts';
import { serviceUpdateCheck } from '../rules/service-update-check.ts';

export class PlanServiceUpdateCheckService extends Context.Service<
  PlanServiceUpdateCheckService,
  { readonly execute: () => Effect.Effect<ServiceUpdateCheck, never> }
>()('@porcelain/access/PlanServiceUpdateCheckService') {
  static readonly layer = Layer.effect(
    PlanServiceUpdateCheckService,
    Effect.gen(function* () {
      const clock = yield* Clock;
      const options = yield* ServiceUpdateCheckOptions;

      return {
        execute: Effect.fn('PlanServiceUpdateCheckService.execute')(
          function* (): Effect.fn.Return<ServiceUpdateCheck, never> {
            return yield* Effect.sync<ServiceUpdateCheck>(() => {
              return serviceUpdateCheck(
                clock.now(),
                options.latestVersionTtlMs,
              );
            });
          },
        ),
      };
    }),
  );
}
