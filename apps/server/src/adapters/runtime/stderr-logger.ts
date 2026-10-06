import { Effect, Layer } from 'effect';
import { Logger, type FailureReport } from '../../ports/logger.ts';
import { failureFields } from '../../runtime/log-fields.ts';
import { Observability } from '../../runtime/observability.ts';

export const StderrLogger = {
  layer: Layer.effect(
    Logger,
    Effect.gen(function* () {
      yield* Observability;
      const context = yield* Effect.context<never>();
      return {
        failure: (input: FailureReport): void => {
          Effect.runSync(
            Effect.logError('Porcelain operation failed').pipe(
              Effect.annotateLogs(failureFields(input)),
              Effect.provideContext(context),
            ),
          );
        },
      };
    }),
  ),
};
