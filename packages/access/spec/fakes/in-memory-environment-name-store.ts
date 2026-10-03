import type { ChosenEnvironmentName } from '../../src/models/environment-name.ts';
import type { EnvironmentNameStore } from '../../src/ports/environment-name-store.ts';

export class InMemoryEnvironmentNameStore implements EnvironmentNameStore {
  private chosen: ChosenEnvironmentName = { name: undefined };

  read(): ChosenEnvironmentName {
    return { ...this.chosen };
  }

  save(input: ChosenEnvironmentName): void {
    this.chosen = { ...input };
  }
}
