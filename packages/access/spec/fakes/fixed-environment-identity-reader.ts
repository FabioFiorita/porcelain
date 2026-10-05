import { Effect } from 'effect';
import type { EnvironmentIdentityReader } from '../../src/ports/environment-identity-reader.ts';

export class FixedEnvironmentIdentityReader implements EnvironmentIdentityReader {
  private readonly identity: string | undefined;

  constructor(identity: string | undefined) {
    this.identity = identity;
  }

  environmentId(): Effect.Effect<string | undefined> {
    return Effect.sync(() => {
      return this.identity;
    });
  }
}
