import type { EnvironmentIdentityStore } from '../ports/environment-identity-store.ts';

export class ReadEnvironmentService {
  private readonly environment: EnvironmentIdentityStore;

  constructor(environment: EnvironmentIdentityStore) {
    this.environment = environment;
  }

  execute(): string {
    return this.environment.environmentId();
  }
}
