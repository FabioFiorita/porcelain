import { Effect } from 'effect';
import { MissingEnvironmentIdentityError } from '../errors/missing-environment-identity-error.ts';
import type { ReadEnvironmentResult } from '../models/read-environment.ts';
import type { EnvironmentIdentityReader } from '../ports/environment-identity-reader.ts';

export class ReadEnvironmentService {
  private readonly environmentIdentity: EnvironmentIdentityReader;

  constructor(environmentIdentity: EnvironmentIdentityReader) {
    this.environmentIdentity = environmentIdentity;
  }

  execute(): Effect.Effect<
    ReadEnvironmentResult,
    MissingEnvironmentIdentityError
  > {
    return Effect.gen({ self: this }, function* () {
      const environmentId = this.environmentIdentity.environmentId();
      if (environmentId === undefined)
        return yield* Effect.fail(new MissingEnvironmentIdentityError());
      return { environmentId };
    });
  }
}
