import { Effect, Layer } from 'effect';
import {
  RemoteAccessStore,
  RouteStateStore,
  RuntimeStatusReader,
} from '@porcelain/access/ports';
import { ReviewLinkSource } from '../../ports/review-link-source.ts';
import { ReviewLinkOptions } from '../../ports/review-link-options.ts';

export const remoteReviewLinkSourceLayer = Layer.effect(
  ReviewLinkSource,
  Effect.gen(function* () {
    const remote = yield* RemoteAccessStore;
    const routes = yield* RouteStateStore;
    const runtime = yield* RuntimeStatusReader;
    const options = yield* ReviewLinkOptions;
    return {
      read: Effect.fn('ReviewLinkSource.read')(function* () {
        const access = yield* remote.read();
        const { states } = routes.read();
        const origins = (['cloudflare', 'tailnet', 'lan'] as const).flatMap(
          (key) => {
            const state = states[key];
            return access[key] && state.kind === 'on' ? state.urls : [];
          },
        );
        const local = runtime.current().address;
        return {
          ...options,
          origins: [...origins, ...(local === '' ? [] : [local])],
        };
      }),
    };
  }),
);
