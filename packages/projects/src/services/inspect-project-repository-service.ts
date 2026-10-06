import { Effect, Context, Layer } from 'effect';
import { RepositoryUnavailableError } from '@porcelain/kernel/errors';
import {
  type InspectProjectRepositoryInput,
  type InspectProjectRepositoryResult,
} from '../models/inspect-project-repository.ts';
import { ProjectRepositoryReader } from '../ports/project-repository-reader.ts';

export class InspectProjectRepositoryService extends Context.Service<
  InspectProjectRepositoryService,
  {
    readonly execute: (
      input: InspectProjectRepositoryInput,
    ) => Effect.Effect<
      InspectProjectRepositoryResult,
      RepositoryUnavailableError
    >;
  }
>()('@porcelain/projects/InspectProjectRepositoryService') {
  static readonly layer = Layer.effect(
    InspectProjectRepositoryService,
    Effect.gen(function* () {
      const projectRepositoryReaderCapability = yield* ProjectRepositoryReader;

      return {
        execute: Effect.fn('InspectProjectRepositoryService.execute')(
          function* (
            input: InspectProjectRepositoryInput,
          ): Effect.fn.Return<
            InspectProjectRepositoryResult,
            RepositoryUnavailableError
          > {
            const repository = yield* projectRepositoryReaderCapability.find({
              path: input.path,
            });
            if (!repository)
              return yield* Effect.fail(new RepositoryUnavailableError());
            return repository;
          },
        ),
      };
    }),
  );
}
