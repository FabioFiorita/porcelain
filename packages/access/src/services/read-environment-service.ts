import { MissingEnvironmentIdentityError } from '../errors/missing-environment-identity-error.ts';
import type { ReadEnvironmentResult } from '../models/read-environment.ts';
import type { EnvironmentIdentityStore } from '../ports/environment-identity-store.ts';

export class ReadEnvironmentService {
  private readonly environmentIdentity: EnvironmentIdentityStore;

  constructor(environmentIdentity: EnvironmentIdentityStore) {
    this.environmentIdentity = environmentIdentity;
  }

  execute(): ReadEnvironmentResult {
    const environmentId = this.environmentIdentity.environmentId();
    if (environmentId === undefined)
      throw new MissingEnvironmentIdentityError();
    return { environmentId };
  }
}
