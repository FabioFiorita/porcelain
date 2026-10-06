import { Effect, Context, Layer } from 'effect';
import {
  type FolderNotFoundError,
  type FolderNotReadableError,
  type UnsupportedFolderNameError,
} from '@porcelain/projects/errors';
import {
  type BrowseProjectFoldersQuery,
  type BrowseProjectFoldersResponse,
} from '@porcelain/contracts/projects';
import { BrowseProjectFoldersService } from '@porcelain/projects/services';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class BrowseProjectFoldersUseCase extends Context.Service<
  BrowseProjectFoldersUseCase,
  {
    readonly execute: (
      input: BrowseProjectFoldersQuery,
    ) => Effect.Effect<
      BrowseProjectFoldersResponse,
      FolderNotFoundError | FolderNotReadableError | UnsupportedFolderNameError
    >;
  }
>()('@porcelain/server/BrowseProjectFoldersUseCase') {
  static readonly layer = Layer.effect(
    BrowseProjectFoldersUseCase,
    Effect.gen(function* () {
      const browseProjectFoldersCapability = yield* BrowseProjectFoldersService;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;

      return {
        execute: Effect.fn('BrowseProjectFoldersUseCase.execute')(function* (
          input: BrowseProjectFoldersQuery,
        ): Effect.fn.Return<
          BrowseProjectFoldersResponse,
          | FolderNotFoundError
          | FolderNotReadableError
          | UnsupportedFolderNameError
        > {
          return yield* lanesCapability.run(
            laneKeysCapability.filesystem(),
            'read',
            () => browseProjectFoldersCapability.execute(input),
          );
        }),
      };
    }),
  );
}
