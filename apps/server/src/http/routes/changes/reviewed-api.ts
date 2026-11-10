import { ReviewedFilesApi } from '@porcelain/contracts/changes';
import { HttpApiBuilder } from 'effect/http-api';
import { Layer, type Context } from 'effect';
import { handlerAudit } from '../../diagnostics.ts';
import { requestBody } from '../../hooks/request-body.ts';
import type { ListReviewedFilesUseCase } from '../../../use-cases/reviews/list-reviewed-files.ts';
import type { SetReviewedFilesUseCase } from '../../../use-cases/reviews/set-reviewed-files.ts';
import type { RemoveReviewedFilesUseCase } from '../../../use-cases/reviews/remove-reviewed-files.ts';
type UseCases = {
  listReviewedFiles: Context.Service.Shape<typeof ListReviewedFilesUseCase>;
  setReviewedFiles: Context.Service.Shape<typeof SetReviewedFilesUseCase>;
  removeReviewedFiles: Context.Service.Shape<typeof RemoveReviewedFilesUseCase>;
};
export function reviewedFilesRoutes(useCases: UseCases) {
  const handlers = HttpApiBuilder.group(
    ReviewedFilesApi,
    'reviewedFiles',
    (handlers) =>
      handlers
        .handle('listReviewedFiles', ({ params, query }) =>
          useCases.listReviewedFiles.execute({ ...params, ...query }),
        )
        .handle('setReviewedFile', ({ params, payload }) =>
          useCases.setReviewedFiles.execute({
            ...params,
            ...payload,
            onConflict: 'refuse',
          }),
        )
        .handle('setReviewedFiles', ({ params, payload }) =>
          useCases.setReviewedFiles.execute({
            ...params,
            ...payload,
            onConflict: 'report',
          }),
        )
        .handle('removeReviewedFile', ({ params, query }) =>
          useCases.removeReviewedFiles.execute({ ...params, ...query }),
        )
        .handle('removeReviewedFiles', ({ params, payload }) =>
          useCases.removeReviewedFiles.execute({ ...params, ...payload }),
        ),
  );
  return HttpApiBuilder.layer(ReviewedFilesApi).pipe(
    Layer.provide(handlers),
    Layer.provide(handlerAudit.layer),
    Layer.provide(requestBody.layer),
  );
}
