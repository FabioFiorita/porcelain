import { requestBody } from '../../hooks/request-body.ts';
import { handlerAudit } from '../../diagnostics.ts';
import { requestBodyLimit } from '../../hooks/request-body.ts';
import { FilesApi } from '@porcelain/contracts/files';
import type { Context } from 'effect';
import { Clock, Effect, Layer } from 'effect';
import { requestCredential } from '../../hooks/authenticate.ts';
import type { PreviewFileTickets } from '../../hooks/preview-file-ticket.ts';
import { RequestContext } from '../../request-context.ts';
import { RequestError } from '../../../runtime/errors/request-error.ts';
import type { ReadPreviewFileUseCase } from '../../../use-cases/files/read-preview-file.ts';
import { previewFileResponse } from './preview-file-response.ts';
import { HttpApiBuilder } from 'effect/http-api';
import { type EditFileUseCase } from '../../../use-cases/files/edit-file.ts';
import { type ListDirectoryUseCase } from '../../../use-cases/files/list-directory.ts';
import { type ListWorktreePathsUseCase } from '../../../use-cases/files/list-worktree-paths.ts';
import { type ReadFileAssetUseCase } from '../../../use-cases/files/read-file-asset.ts';
import { type ReadPreviewAssetsUseCase } from '../../../use-cases/files/read-preview-assets.ts';
import { type ReadTextFileUseCase } from '../../../use-cases/files/read-text-file.ts';

type FilesUseCases = {
  listDirectory: Context.Service.Shape<typeof ListDirectoryUseCase>;
  listWorktreePaths: Context.Service.Shape<typeof ListWorktreePathsUseCase>;
  readTextFile: Context.Service.Shape<typeof ReadTextFileUseCase>;
  readFileAsset: Context.Service.Shape<typeof ReadFileAssetUseCase>;
  readPreviewFile: Context.Service.Shape<typeof ReadPreviewFileUseCase>;
  readPreviewAssets: Context.Service.Shape<typeof ReadPreviewAssetsUseCase>;
  editFile: Context.Service.Shape<typeof EditFileUseCase>;
};

function filesGroup(useCases: FilesUseCases, tickets: PreviewFileTickets) {
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
      .handle('readPreviewFile', ({ params, query, request }) =>
        Effect.gen(function* () {
          const file = yield* useCases.readPreviewFile.execute({
            ...params,
            ...query,
          });
          if (!file)
            return yield* Effect.die(
              new RequestError({ statusCode: 404, message: 'File not found' }),
            );
          return previewFileResponse(file, request.headers);
        }),
      )
      .handle('readPreviewAssets', ({ params, payload }) =>
        Effect.gen(function* () {
          const context = yield* RequestContext;
          const credential = requestCredential(context);
          const now = yield* Clock.currentTimeMillis;
          const response = yield* useCases.readPreviewAssets.execute({
            ...params,
            ...payload,
          });
          return {
            assets: response.assets.map((asset) =>
              asset.kind !== 'stream'
                ? asset
                : credential
                  ? {
                      ...asset,
                      ticket: tickets.issue(
                        { ...params, path: asset.path },
                        credential,
                        now,
                      ),
                    }
                  : { kind: 'unavailable' as const, path: asset.path },
            ),
          };
        }),
      )
      .handle('editFile', ({ params, payload }) =>
        useCases.editFile.execute({ ...params, ...payload }),
      ),
  );
}

export function filesRoutes(
  useCases: FilesUseCases,
  limits: { editFileBodyBytes: number },
  tickets: PreviewFileTickets,
) {
  const handlers = filesGroup(useCases, tickets);
  const api = HttpApiBuilder.layer(FilesApi).pipe(
    Layer.provide(handlers),
    Layer.provide(handlerAudit.layer),
    Layer.provide(requestBody.layer),
  );
  return api.pipe(
    Layer.provide(
      requestBodyLimit(
        FilesApi.groups.files.endpoints.editFile,
        limits.editFileBodyBytes,
      ),
    ),
  );
}
