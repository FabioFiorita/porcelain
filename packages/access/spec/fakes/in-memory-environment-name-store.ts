import { Effect } from 'effect';
import type { ChosenEnvironmentName } from '../../src/models/environment-name.ts';
import type { EnvironmentNameStore } from '../../src/ports/environment-name-store.ts';

export class InMemoryEnvironmentNameStore implements EnvironmentNameStore {
  private chosen: ChosenEnvironmentName = { name: undefined };

  read(): Effect.Effect<ChosenEnvironmentName> {
    return Effect.sync(() => {
      return { ...this.chosen };
    });
  }

  save(input: ChosenEnvironmentName): Effect.Effect<void> {
    return Effect.sync(() => {
      this.chosen = { ...input };
    });
  }
}
