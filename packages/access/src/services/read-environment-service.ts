import { Effect, Context, Layer } from 'effect';
import { MissingEnvironmentIdentityError } from '../errors/missing-environment-identity-error.ts';
import type { ReadEnvironmentResult } from '../models/read-environment.ts';
import { EnvironmentIdentityReader } from '../ports/environment-identity-reader.ts';

export class ReadEnvironmentService extends Context.Service<
  ReadEnvironmentService,
  {
    readonly execute: () => Effect.Effect<
      ReadEnvironmentResult,
      MissingEnvironmentIdentityError
    >;
  }
>()('@porcelain/access/ReadEnvironmentService') {
  static readonly layer = Layer.effect(
    ReadEnvironmentService,
    Effect.gen(function* () {
      const environmentIdentity = yield* EnvironmentIdentityReader;

      return {
        execute: Effect.fn('ReadEnvironmentService.execute')(
          function* (): Effect.fn.Return<
            ReadEnvironmentResult,
            MissingEnvironmentIdentityError
          > {
            const environmentId = yield* environmentIdentity.environmentId();
            if (environmentId === undefined)
              return yield* Effect.fail(new MissingEnvironmentIdentityError());
            return { environmentId };
          },
        ),
      };
    }),
  );
}
