import { ChangesApi } from '@porcelain/contracts/changes';
import { Layer } from 'effect';
import { HttpApiBuilder } from 'effect/http-api';
import { effectRoutes } from '../../effect-bridge.ts';
import type { ListBranchBasesUseCase } from '../../../use-cases/changes/list-branch-bases.ts';
import type { ListCommitsUseCase } from '../../../use-cases/changes/list-commits.ts';
import type { ListFileCommitsUseCase } from '../../../use-cases/changes/list-file-commits.ts';
import type { ReadBranchChangesUseCase } from '../../../use-cases/changes/read-branch-changes.ts';
import type { ReadBranchDiffsUseCase } from '../../../use-cases/changes/read-branch-diffs.ts';
import type { ReadChangeDiffsUseCase } from '../../../use-cases/changes/read-change-diffs.ts';
import type { ReadChangeLinesUseCase } from '../../../use-cases/changes/read-change-lines.ts';
import type { ReadChangesUseCase } from '../../../use-cases/changes/read-changes.ts';
import type { ReadCommitDiffsUseCase } from '../../../use-cases/changes/read-commit-diffs.ts';
import type { ReadCommitFilesUseCase } from '../../../use-cases/changes/read-commit-files.ts';
import type { ReadGitStatusUseCase } from '../../../use-cases/changes/read-git-status.ts';

type ChangesUseCases = {
  listBranchBases: Pick<ListBranchBasesUseCase, 'execute'>;
  listCommits: Pick<ListCommitsUseCase, 'execute'>;
  listFileCommits: Pick<ListFileCommitsUseCase, 'execute'>;
  readBranchChanges: Pick<ReadBranchChangesUseCase, 'execute'>;
  readBranchDiffs: Pick<ReadBranchDiffsUseCase, 'execute'>;
  readChangeDiffs: Pick<ReadChangeDiffsUseCase, 'execute'>;
  readChangeLines: Pick<ReadChangeLinesUseCase, 'execute'>;
  readChanges: Pick<ReadChangesUseCase, 'execute'>;
  readCommitDiffs: Pick<ReadCommitDiffsUseCase, 'execute'>;
  readCommitFiles: Pick<ReadCommitFilesUseCase, 'execute'>;
  readGitStatus: Pick<ReadGitStatusUseCase, 'execute'>;
};

export function changesRoutes(useCases: ChangesUseCases) {
  const handlers = HttpApiBuilder.group(ChangesApi, 'changes', (handlers) =>
    handlers
      .handle('listBranchBases', ({ params }) =>
        useCases.listBranchBases.execute(params),
      )
      .handle('listCommits', ({ params, query }) =>
        useCases.listCommits.execute({ ...params, ...query }),
      )
      .handle('listFileCommits', ({ params, query }) =>
        useCases.listFileCommits.execute({ ...params, ...query }),
      )
      .handle('readBranchChanges', ({ params, query }) =>
        useCases.readBranchChanges.execute({ ...params, ...query }),
      )
      .handle('readBranchDiffs', ({ params, payload }) =>
        useCases.readBranchDiffs.execute({ ...params, ...payload }),
      )
      .handle('readChangeDiffs', ({ params, payload }) =>
        useCases.readChangeDiffs.execute({ ...params, ...payload }),
      )
      .handle('readChangeLines', ({ params, query }) =>
        useCases.readChangeLines.execute({ ...params, ...query }),
      )
      .handle('readChanges', ({ params }) =>
        useCases.readChanges.execute(params),
      )
      .handle('readCommitDiffs', ({ params, payload }) =>
        useCases.readCommitDiffs.execute({ ...params, ...payload }),
      )
      .handle('readCommitFiles', ({ params, query }) =>
        useCases.readCommitFiles.execute({ ...params, ...query }),
      )
      .handle('readGitStatus', ({ params }) =>
        useCases.readGitStatus.execute(params),
      ),
  );
  return effectRoutes(
    ChangesApi,
    HttpApiBuilder.layer(ChangesApi).pipe(Layer.provide(handlers)),
  );
}
