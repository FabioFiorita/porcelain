import { Effect, Context, Layer } from 'effect';
import {
  type ReadRepositoryOriginInput,
  type ReadRepositoryOriginResult,
} from '../models/read-repository-origin.ts';
import { ProjectRepositoryReader } from '../ports/project-repository-reader.ts';

export class ReadRepositoryOriginService extends Context.Service<
  ReadRepositoryOriginService,
  {
    readonly execute: (
      input: ReadRepositoryOriginInput,
    ) => Effect.Effect<ReadRepositoryOriginResult, never>;
  }
>()('@porcelain/projects/ReadRepositoryOriginService') {
  static readonly layer = Layer.effect(
    ReadRepositoryOriginService,
    Effect.gen(function* () {
      const projectRepositoryReaderCapability = yield* ProjectRepositoryReader;

      return {
        execute: Effect.fn('ReadRepositoryOriginService.execute')(function* (
          input: ReadRepositoryOriginInput,
        ): Effect.fn.Return<ReadRepositoryOriginResult, never> {
          return {
            originUrl: yield* projectRepositoryReaderCapability.readOriginUrl({
              path: input.path,
            }),
          };
        }),
      };
    }),
  );
}
