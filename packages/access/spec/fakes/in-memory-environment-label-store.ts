import { Effect } from 'effect';
import type { ChosenEnvironmentLabel } from '../../src/models/environment-label.ts';
import type { EnvironmentLabelStore } from '../../src/ports/environment-label-store.ts';

export class InMemoryEnvironmentLabelStore implements EnvironmentLabelStore {
  private chosen: ChosenEnvironmentLabel = {
    name: undefined,
    icon: undefined,
  };

  read(): Effect.Effect<ChosenEnvironmentLabel> {
    return Effect.sync(() => {
      return { ...this.chosen };
    });
  }

  save(input: ChosenEnvironmentLabel): Effect.Effect<void> {
    return Effect.sync(() => {
      this.chosen = { ...input };
    });
  }
}
