import { requestBody } from '../../hooks/request-body.ts';
import { handlerAudit } from '../../diagnostics.ts';
import {
  GitActionsApi,
  runGitActionResponseSchema,
} from '@porcelain/contracts/git-actions';
import type { Context } from 'effect';
import { Effect, Layer, Schema } from 'effect';
import { HttpServerResponse } from 'effect/http';
import { HttpApiBuilder } from 'effect/http-api';
import { type DismissInterruptedGitActionUseCase } from '../../../use-cases/git-actions/dismiss-interrupted-git-action.ts';
import { type GenerateCommitDraftUseCase } from '../../../use-cases/git-actions/generate-commit-draft.ts';
import { type ListCommitModelsUseCase } from '../../../use-cases/git-actions/list-commit-models.ts';
import { type ReadGitActionReceiptUseCase } from '../../../use-cases/git-actions/read-git-action-receipt.ts';
import { type RunGitActionUseCase } from '../../../use-cases/git-actions/run-git-action.ts';
import { gitActionReceiptStatus } from '../../status-policy.ts';

type GitActionsUseCases = {
  dismissInterruptedGitAction: Pick<
    Context.Service.Shape<typeof DismissInterruptedGitActionUseCase>,
    'execute'
  >;
  generateCommitDraft: Pick<
    Context.Service.Shape<typeof GenerateCommitDraftUseCase>,
    'execute'
  >;
  listCommitModels: Pick<
    Context.Service.Shape<typeof ListCommitModelsUseCase>,
    'execute'
  >;
  readGitActionReceipt: Pick<
    Context.Service.Shape<typeof ReadGitActionReceiptUseCase>,
    'execute'
  >;
  runGitAction: Pick<
    Context.Service.Shape<typeof RunGitActionUseCase>,
    'execute'
  >;
};

export function gitActionsRoutes(useCases: GitActionsUseCases) {
  const handlers = HttpApiBuilder.group(
    GitActionsApi,
    'gitActions',
    (handlers) =>
      handlers
        .handle('dismissInterruptedGitAction', ({ params }) =>
          useCases.dismissInterruptedGitAction.execute(params),
        )
        .handle('generateCommitDraft', ({ params, payload }) =>
          useCases.generateCommitDraft.execute({ ...params, ...payload }),
        )
        .handle('listCommitModels', () => useCases.listCommitModels.execute())
        .handle('readGitActionReceipt', ({ params }) =>
          useCases.readGitActionReceipt.execute(params),
        )
        .handle('runGitAction', ({ params, payload }) =>
          Effect.flatMap(
            useCases.runGitAction.execute({ ...params, ...payload }),
            (receipt) =>
              Schema.encodeEffect(runGitActionResponseSchema)(receipt).pipe(
                Effect.flatMap((body) =>
                  HttpServerResponse.json(body, {
                    status: gitActionReceiptStatus(receipt),
                  }),
                ),
                Effect.orDie,
              ),
          ),
        ),
  );
  return HttpApiBuilder.layer(GitActionsApi).pipe(
    Layer.provide(handlers),
    Layer.provide(handlerAudit.layer),
    Layer.provide(requestBody.layer),
  );
}
