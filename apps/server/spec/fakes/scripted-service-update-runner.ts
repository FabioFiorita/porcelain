import { Effect, Exit, Scope } from 'effect';
import type {
  ServiceUpdateState,
  ServiceUpdateTarget,
} from '@porcelain/access/models';
import type { ServiceUpdateRunner } from '../../src/ports/service-update-runner.ts';

export class ScriptedServiceUpdateRunner implements ServiceUpdateRunner {
  private state: ServiceUpdateState;
  private readonly attempts: (readonly ServiceUpdateState[])[];
  private readonly stepMs: number;
  private readonly scope = Scope.makeUnsafe();

  constructor(
    initial: ServiceUpdateState,
    attempts: (readonly ServiceUpdateState[])[],
    stepMs: number,
  ) {
    this.state = initial;
    this.attempts = attempts;
    this.stepMs = stepMs;
  }

  read(): Effect.Effect<ServiceUpdateState> {
    return Effect.sync(() => structuredClone(this.state));
  }

  start(_input: ServiceUpdateTarget): Effect.Effect<void> {
    return Effect.gen({ self: this }, function* () {
      const next = this.attempts.shift();
      const [claimed = this.state, ...later] = next ?? [];
      this.state = claimed;
      yield* Effect.forkIn(
        Effect.forEach(later, (state) =>
          Effect.sleep(this.stepMs).pipe(
            Effect.andThen(
              Effect.sync(() => {
                this.state = state;
              }),
            ),
          ),
        ),
        this.scope,
      );
    });
  }

  close(): Effect.Effect<void> {
    return Scope.close(this.scope, Exit.void);
  }
}
