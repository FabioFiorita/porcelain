import { Effect } from 'effect';
import type {
  ChosenEnvironmentName,
  EnvironmentName,
} from '../models/environment-name.ts';
import type { EnvironmentNameStore } from '../ports/environment-name-store.ts';
import type { HostNameReader } from '../ports/host-name-reader.ts';
import { environmentName } from '../rules/environment-name.ts';

export class RenameEnvironmentService {
  private readonly names: EnvironmentNameStore;
  private readonly hostNames: HostNameReader;

  constructor(names: EnvironmentNameStore, hostNames: HostNameReader) {
    this.names = names;
    this.hostNames = hostNames;
  }

  execute(input: ChosenEnvironmentName): Effect.Effect<EnvironmentName, never> {
    return Effect.sync(() => {
      this.names.save(input);
      return environmentName(input, this.hostNames.hostName());
    });
  }
}
