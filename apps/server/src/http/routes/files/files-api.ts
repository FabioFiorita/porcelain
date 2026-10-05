import { FilesApi } from '@porcelain/contracts/files';
import { Layer } from 'effect';
import { HttpApiBuilder } from 'effect/http-api';
import { effectRoutes } from '../../effect-bridge.ts';
import type { EditFileUseCase } from '../../../use-cases/files/edit-file.ts';
import type { ListDirectoryUseCase } from '../../../use-cases/files/list-directory.ts';
import type { ListWorktreePathsUseCase } from '../../../use-cases/files/list-worktree-paths.ts';
import type { ReadFileAssetUseCase } from '../../../use-cases/files/read-file-asset.ts';
import type { ReadPreviewAssetsUseCase } from '../../../use-cases/files/read-preview-assets.ts';
import type { ReadTextFileUseCase } from '../../../use-cases/files/read-text-file.ts';

type FilesUseCases = {
  listDirectory: ListDirectoryUseCase;
  listWorktreePaths: ListWorktreePathsUseCase;
  readTextFile: ReadTextFileUseCase;
  readFileAsset: ReadFileAssetUseCase;
  readPreviewAssets: ReadPreviewAssetsUseCase;
  editFile: EditFileUseCase;
};

function filesGroup(useCases: FilesUseCases) {
  return HttpApiBuilder.group(FilesApi, 'files', (handlers) =>
    handlers
      .handle('listDirectory', ({ params, query }) =>
        useCases.listDirectory.execute({ ...params, ...query }),
      )
      .handle('listWorktreePaths', ({ params }) =>
        useCases.listWorktreePaths.execute(params),
      )
      .handle('readTextFile', ({ params, query }) =>
        useCases.readTextFile.execute({ ...params, ...query }),
      )
      .handle('readFileAsset', ({ params, query }) =>
        useCases.readFileAsset.execute({ ...params, ...query }),
      )
      .handle('readPreviewAssets', ({ params, payload }) =>
        useCases.readPreviewAssets.execute({ ...params, ...payload }),
      )
      .handle('editFile', ({ params, payload }) =>
        useCases.editFile.execute({ ...params, ...payload }),
      ),
  );
}

export function filesRoutes(
  useCases: FilesUseCases,
  limits: { editFileBodyBytes: number },
) {
  const handlers = filesGroup(useCases);
  const api = HttpApiBuilder.layer(FilesApi).pipe(Layer.provide(handlers));
  return effectRoutes(FilesApi, api, { editFile: limits.editFileBodyBytes });
}
