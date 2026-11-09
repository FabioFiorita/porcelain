import { presentWalkthrough } from '../../presenters/walkthrough.ts';
import { Layer, Effect, type Context } from 'effect';
import { HttpApiBuilder } from 'effect/http-api';
import { HttpServerResponse } from 'effect/http';
import { WalkthroughsApi } from '@porcelain/contracts/walkthroughs';
import { requestBody } from '../../hooks/request-body.ts';
import { handlerAudit } from '../../diagnostics.ts';
import type { StartWalkthroughUseCase } from '../../../use-cases/walkthroughs/start-walkthrough.ts';
import type { ReadWalkthroughUseCase } from '../../../use-cases/walkthroughs/read-walkthrough.ts';
import type { ReadWalkthroughAssetUseCase } from '../../../use-cases/walkthroughs/read-walkthrough-asset.ts';
export function walkthroughsRoutes(useCases: {
  start: Context.Service.Shape<typeof StartWalkthroughUseCase>;
  read: Context.Service.Shape<typeof ReadWalkthroughUseCase>;
  asset: Context.Service.Shape<typeof ReadWalkthroughAssetUseCase>;
}) {
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
        ),
  );
  return HttpApiBuilder.layer(WalkthroughsApi).pipe(
    Layer.provide(handlers),
    Layer.provide(handlerAudit.layer),
    Layer.provide(requestBody.layer),
  );
}
