import type { MissingEnvironmentIdentityError } from '@porcelain/access/errors';
import { Effect } from 'effect';
import type { WorktreeAccess } from '../../runtime/worktree-access.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import type { InvalidLineRangeError } from '@porcelain/kernel/errors';
import type { ReadEnvironmentService } from '@porcelain/access/services';
import type { ReadChangeLinesService } from '@porcelain/changes/services';
import type {
  ReadChangeLinesQuery,
  ReadChangeLinesResponse,
} from '@porcelain/contracts/changes';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type {
  ReadTextFileService,
  ReadTextFileFailure,
} from '@porcelain/files/services';

export class ReadChangeLinesUseCase {
  private readonly access: WorktreeAccess;
  private readonly readTextFile: ReadTextFileService;
  private readonly readChangeLines: ReadChangeLinesService;
  private readonly readEnvironment: ReadEnvironmentService;

  constructor(
    access: WorktreeAccess,
    readTextFile: ReadTextFileService,
    readChangeLines: ReadChangeLinesService,
    readEnvironment: ReadEnvironmentService,
  ) {
    this.access = access;
    this.readTextFile = readTextFile;
    this.readChangeLines = readChangeLines;
    this.readEnvironment = readEnvironment;
  }

  execute(
    input: WorktreeParams & ReadChangeLinesQuery,
  ): Effect.Effect<
    ReadChangeLinesResponse,
    | MissingEnvironmentIdentityError
    | WorktreeAccessFailure
    | ReadTextFileFailure
    | InvalidLineRangeError
  > {
    const { worktreeId, path, from, to, at } = input;
    return this.access.read(worktreeId, () =>
      Effect.gen({ self: this }, function* () {
        const { text } = yield* this.readTextFile.execute({
          worktreeId,
          path,
          at,
        });
        const lines = yield* this.readChangeLines.execute({
          path,
          from,
          to,
          at,
          text,
        });
        return {
          environmentId: (yield* this.readEnvironment.execute()).environmentId,
          worktreeId,
          ...lines,
        };
      }),
    );
  }
}
