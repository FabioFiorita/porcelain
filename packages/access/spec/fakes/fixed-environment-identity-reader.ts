import type { EnvironmentIdentityReader } from '../../src/ports/environment-identity-reader.ts';

export class FixedEnvironmentIdentityReader implements EnvironmentIdentityReader {
  private readonly identity: string | undefined;

  constructor(identity: string | undefined) {
    this.identity = identity;
  }

  environmentId(): string | undefined {
    return this.identity;
  }
}
