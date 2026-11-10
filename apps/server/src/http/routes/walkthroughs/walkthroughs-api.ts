import {
  presentWalkthrough,
  presentWalkthroughConversations,
} from '../../presenters/walkthrough.ts';
import { Layer, Effect, type Context } from 'effect';
import { HttpApiBuilder } from 'effect/http-api';
import { HttpServerResponse } from 'effect/http';
import { WalkthroughsApi } from '@porcelain/contracts/walkthroughs';
import type {
  WalkthroughConversationsResult,
  WalkthroughPostResult,
} from '@porcelain/contracts/walkthroughs';
import { requestBody } from '../../hooks/request-body.ts';
import { handlerAudit } from '../../diagnostics.ts';
import type { StartWalkthroughUseCase } from '../../../use-cases/walkthroughs/start-walkthrough.ts';
import type { ReadWalkthroughUseCase } from '../../../use-cases/walkthroughs/read-walkthrough.ts';
import type { ReadWalkthroughAssetUseCase } from '../../../use-cases/walkthroughs/read-walkthrough-asset.ts';
import type { ListWalkthroughConversationsUseCase } from '../../../use-cases/walkthroughs/list-walkthrough-conversations.ts';
import type { AddWalkthroughMessageUseCase } from '../../../use-cases/walkthroughs/add-walkthrough-message.ts';
import type { RetryWalkthroughAnswerUseCase } from '../../../use-cases/walkthroughs/retry-walkthrough-answer.ts';
import type { SaveWalkthroughMessageUseCase } from '../../../use-cases/walkthroughs/save-walkthrough-message.ts';
import type { PostWalkthroughMessagesUseCase } from '../../../use-cases/walkthroughs/post-walkthrough-messages.ts';
import type { ReadWalkthroughBriefUseCase } from '../../../use-cases/walkthroughs/read-walkthrough-brief.ts';
export function walkthroughsRoutes(useCases: {
  start: Context.Service.Shape<typeof StartWalkthroughUseCase>;
  read: Context.Service.Shape<typeof ReadWalkthroughUseCase>;
  asset: Context.Service.Shape<typeof ReadWalkthroughAssetUseCase>;
  conversations: Context.Service.Shape<
    typeof ListWalkthroughConversationsUseCase
  >;
  addMessage: Context.Service.Shape<typeof AddWalkthroughMessageUseCase>;
  retryAnswer: Context.Service.Shape<typeof RetryWalkthroughAnswerUseCase>;
  saveMessage: Context.Service.Shape<typeof SaveWalkthroughMessageUseCase>;
  postMessages: Context.Service.Shape<typeof PostWalkthroughMessagesUseCase>;
  brief: Context.Service.Shape<typeof ReadWalkthroughBriefUseCase>;
}) {
  const presentPost = (result: {
    outcome: WalkthroughPostResult;
    view: WalkthroughConversationsResult;
  }) => ({
    outcome: result.outcome,
    view: presentWalkthroughConversations(result.view),
  });
  const handlers = HttpApiBuilder.group(
    WalkthroughsApi,
    'walkthroughs',
    (handlers) =>
      handlers
        .handle('startWalkthrough', ({ params, payload }) =>
          useCases.start
            .execute({ ...params, ...payload })
            .pipe(Effect.map(presentWalkthrough)),
        )
        .handle('readWalkthrough', ({ params }) =>
          useCases.read.execute(params).pipe(
            Effect.map((value) => ({
              ...value,
              walkthrough:
                value.walkthrough === undefined
                  ? undefined
                  : presentWalkthrough(value.walkthrough),
            })),
          ),
        )
        .handle(
          'readWalkthroughAsset',
          ({ params }) =>
            useCases.asset.execute(params).pipe(
              Effect.map((asset) =>
                HttpServerResponse.uint8Array(asset.bytes, {
                  contentType: asset.mediaType,
                }),
              ),
            ),
          { uninterruptible: false },
        )
        .handle('listWalkthroughConversations', ({ params }) =>
          useCases.conversations
            .execute(params)
            .pipe(Effect.map(presentWalkthroughConversations)),
        )
        .handle('addWalkthroughMessage', ({ params, payload }) =>
          useCases.addMessage
            .execute({ ...params, ...payload })
            .pipe(Effect.map(presentWalkthroughConversations)),
        )
        .handle('retryWalkthroughAnswer', ({ params }) =>
          useCases.retryAnswer
            .execute(params)
            .pipe(Effect.map(presentWalkthroughConversations)),
        )
        .handle('saveWalkthroughMessage', ({ params, payload }) =>
          useCases.saveMessage
            .execute({ ...params, ...payload })
            .pipe(Effect.map(presentWalkthroughConversations)),
        )
        .handle('postWalkthroughMessage', ({ params }) =>
          useCases.postMessages.execute(params).pipe(Effect.map(presentPost)),
        )
        .handle('postSavedWalkthroughMessages', ({ params }) =>
          useCases.postMessages.execute(params).pipe(Effect.map(presentPost)),
        )
        .handle('readWalkthroughBrief', ({ params, query }) =>
          useCases.brief
            .execute({ ...params, ...query })
            .pipe(Effect.map((text) => ({ text }))),
        ),
  );
  return HttpApiBuilder.layer(WalkthroughsApi).pipe(
    Layer.provide(handlers),
    Layer.provide(handlerAudit.layer),
    Layer.provide(requestBody.layer),
  );
}
