import { MissingEnvironmentIdentityError } from '../errors/missing-environment-identity-error.ts';
import type { ReadEnvironmentResult } from '../models/read-environment.ts';
import type { EnvironmentIdentityStore } from '../ports/environment-identity-store.ts';

export class ReadEnvironmentService {
  private readonly environmentIdentityStore: EnvironmentIdentityStore;

  constructor(environmentIdentityStore: EnvironmentIdentityStore) {
    this.environmentIdentityStore = environmentIdentityStore;
  }

  execute(): ReadEnvironmentResult {
    const environmentId = this.environmentIdentityStore.environmentId();
    if (environmentId === undefined)
      throw new MissingEnvironmentIdentityError();
    return { environmentId };
  }
}
