import {
  Cause,
  Context,
  Effect,
  Exit,
  Formatter,
  Layer,
  Logger,
  Metric,
  Tracer,
} from 'effect';
import { redactedLogValue } from './log-fields.ts';

type Operation =
  | { readonly kind: 'request'; readonly name: string; readonly method: string }
  | { readonly kind: 'job'; readonly name: string };

const operations = Metric.counter('porcelain.operations', {
  description:
    'Completed server operations, including failures and interruption',
  incremental: true,
});
const elapsed = Metric.timer('porcelain.operation.duration', {
  description: 'Time spent executing server operations',
});

const nativeLogging = Logger.layer([
  Logger.withConsoleError(
    Logger.map(Logger.formatStructured, (entry) =>
      Formatter.formatJson(redactedLogValue(entry)),
    ),
  ),
  Logger.tracerLogger,
]);
const nativeReferences = Layer.mergeAll(
  nativeLogging,
  Layer.sync(Metric.MetricRegistry, () => new Map()),
  Layer.succeed(Tracer.Tracer, Tracer.nativeTracer),
);

export class Observability extends Context.Service<
  Observability,
  {
    readonly measure: <A, E, R>(
      operation: Operation,
      effect: Effect.Effect<A, E, R>,
      outcome?: (value: A) => 'success' | 'failure',
    ) => Effect.Effect<A, E, R>;
    readonly snapshot: Effect.Effect<ReadonlyArray<Metric.Metric.Snapshot>>;
  }
>()('@porcelain/server/Observability') {
  static readonly layer = Layer.effect(
    Observability,
    Effect.gen(function* () {
      const registry = yield* Metric.MetricRegistry;
      const tracer = yield* Tracer.Tracer;
      const loggers = yield* Logger.CurrentLoggers;
      return {
        measure: <A, E, R>(
          operation: Operation,
          effect: Effect.Effect<A, E, R>,
          outcome?: (value: A) => 'success' | 'failure',
        ): Effect.Effect<A, E, R> => {
          const attributes = { ...operation, service: 'porcelain' };
          return effect.pipe(
            Effect.onExit((exit) =>
              Metric.update(
                operations.pipe(
                  Metric.withAttributes({
                    ...attributes,
                    outcome: Exit.isSuccess(exit)
                      ? (outcome?.(exit.value) ?? 'success')
                      : Cause.hasInterruptsOnly(exit.cause)
                        ? 'interrupted'
                        : 'failure',
                  }),
                ),
                1,
              ),
            ),
            Effect.trackDuration(
              elapsed.pipe(Metric.withAttributes(attributes)),
            ),
            Effect.withSpan(`${operation.kind}:${operation.name}`, {
              attributes,
            }),
            Effect.provideService(Metric.MetricRegistry, registry),
            Effect.provideService(Tracer.Tracer, tracer),
            Effect.provideService(Logger.CurrentLoggers, loggers),
          );
        },
        snapshot: Metric.snapshot.pipe(
          Effect.provideService(Metric.MetricRegistry, registry),
        ),
      };
    }),
  ).pipe(Layer.provideMerge(nativeReferences));
}
