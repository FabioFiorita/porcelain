import type { Effect } from 'effect';

export interface JobRunner<E = never> {
  execute(): Effect.Effect<void, E>;
}
