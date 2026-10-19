import { Effect, Layer } from 'effect';
import {
  RemoteAccessStore,
  NetworkAddressReader,
} from '@porcelain/access/ports';
import { ReviewLinkSource } from '../../ports/review-link-source.ts';
import { ReviewLinkOptions } from '../../ports/review-link-options.ts';

export const remoteReviewLinkSourceLayer = Layer.effect(
  ReviewLinkSource,
  Effect.gen(function* () {
    const remote = yield* RemoteAccessStore;
    const network = yield* NetworkAddressReader;
    const options = yield* ReviewLinkOptions;
    return {
      read: Effect.fn('ReviewLinkSource.read')(function* () {
        const access = yield* remote.read();
        const lan = network
          .list()
          .find(
            (address) =>
              !address.internal &&
              address.family === 'IPv4' &&
              (access.lanNetwork === undefined ||
                address.interfaceName === access.lanNetwork.interfaceName),
          );
        return {
          ...options,
          localHost: lan?.address ?? options.localHost,
          cloudflare: access.cloudflare ? access.cloudflareHostname : undefined,
          tailnet: access.tailnet ? access.tailnetHostname : undefined,
          tailnetPort: access.tailnetPort,
        };
      }),
    };
  }),
);
