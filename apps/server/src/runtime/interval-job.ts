import { Cause, Context, Effect, Exit, Schedule, Scope } from 'effect';
import type { Logger } from '../ports/logger.ts';
import type { JobRunner } from '../ports/job-runner.ts';
import type { Job } from '../ports/job.ts';

type JobSchedule = {
  everyMs?: number | undefined;
  atStart?: boolean | undefined;
  atStop?: boolean | undefined;
};

export class JobSequence<Failure> implements JobRunner<Failure> {
  private readonly works: readonly JobRunner<Failure>[];
  constructor(works: readonly JobRunner<Failure>[]) {
    this.works = works;
  }
  execute(): Effect.Effect<void, Failure> {
    return Effect.forEach(this.works, (work) => work.execute(), {
      discard: true,
      concurrency: 1,
    });
  }
}

export class IntervalJob<Failure> implements Job {
  private readonly name: string;
  private readonly work: JobRunner<Failure>;
  private readonly schedule: JobSchedule;
  private readonly logger: Logger;
  private readonly context: Context.Context<never>;
  private scope: Scope.Closeable | undefined;
  private stopping: Promise<void> | undefined;

  constructor(
    name: string,
    work: JobRunner<Failure>,
    schedule: JobSchedule,
    logger: Logger,
    context: Context.Context<never> = Context.empty(),
  ) {
    this.name = name;
    this.work = work;
    this.schedule = schedule;
    this.logger = logger;
    this.context = context;
  }

  start(): void {
    if (this.scope) return;
    const scope = Scope.makeUnsafe();
    this.scope = scope;
    this.stopping = undefined;
    const everyMs = this.schedule.everyMs;
    if (!this.schedule.atStart && everyMs === undefined) return;
    const repeated =
      everyMs === undefined
        ? this.attempt()
        : this.attempt().pipe(
            Effect.repeat(Schedule.fixed(everyMs)),
            Effect.asVoid,
          );
    const scheduled =
      this.schedule.atStart || everyMs === undefined
        ? repeated
        : Effect.delay(repeated, everyMs);
    Effect.runSyncWith(this.context)(
      Effect.forkIn(scheduled, scope, { startImmediately: true }),
    );
  }

  stop(): Promise<void> {
    if (this.stopping) return this.stopping;
    const scope = this.scope;
    if (!scope) return Promise.resolve();
    this.stopping = Effect.runPromiseWith(this.context)(
      Scope.close(scope, Exit.void).pipe(
        Effect.andThen(this.schedule.atStop ? this.attempt() : Effect.void),
        Effect.ensuring(
          Effect.sync(() => {
            this.scope = undefined;
          }),
        ),
      ),
    );
    return this.stopping;
  }

  private attempt(): Effect.Effect<void> {
    return Effect.suspend(() => this.work.execute()).pipe(
      Effect.catchCause((cause) =>
        Cause.hasInterruptsOnly(cause)
          ? Effect.interrupt
          : Effect.sync(() => {
              this.logger.failure({
                kind: 'job',
                job: this.name,
                error: Cause.squash(cause),
              });
            }),
      ),
    );
  }
}
