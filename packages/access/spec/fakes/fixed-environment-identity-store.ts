import type { EnvironmentIdentityStore } from '../../src/ports/environment-identity-store.ts';

export class FixedEnvironmentIdentityStore implements EnvironmentIdentityStore {
  private readonly identity: string | undefined;

  constructor(identity: string | undefined) {
    this.identity = identity;
  }

  environmentId(): string | undefined {
    return this.identity;
  }
}
