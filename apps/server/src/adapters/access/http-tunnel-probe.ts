import { Clock, Effect, Layer, Result, Schema } from 'effect';
import {
  readHealthResponseSchema,
  PublicAccessApi,
} from '@porcelain/contracts/access';
import type { TunnelAnswer, TunnelTarget } from '@porcelain/access/models';
import { TunnelProbe } from '@porcelain/access/ports';
import { HttpApiClient } from 'effect/http-api';
import { FetchHttpClient, HttpClient } from 'effect/http';

export const httpTunnelProbeLayer = (options: { timeoutMs: number }) =>
  Layer.effect(
    TunnelProbe,
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      return {
        probe: Effect.fn('HttpTunnelProbe.probe')(function* (
          input: TunnelTarget,
        ): Effect.fn.Return<TunnelAnswer> {
          const deadline = (yield* Clock.currentTimeMillis) + options.timeoutMs;
          const response = yield* client
            .get(
              new URL(
                HttpApiClient.urlBuilder(
                  PublicAccessApi,
                ).publicAccess.readHealth(),
                input.origin,
              ).href,
              { headers: { accept: 'application/json' } },
            )
            .pipe(
              Effect.provideService(FetchHttpClient.RequestInit, {
                redirect: 'error',
              }),
              Effect.timeout(options.timeoutMs),
              Effect.catch(() => Effect.succeed(undefined)),
            );
          if (response === undefined || response.status >= 500)
            return { kind: 'unreachable' };
          if (response.status < 200 || response.status >= 300)
            return { kind: 'foreign' };
          const body = yield* response.json.pipe(
            Effect.timeout(
              Math.max(0, deadline - (yield* Clock.currentTimeMillis)),
            ),
            Effect.catch(() => Effect.succeed(undefined)),
          );
          const health = Schema.decodeUnknownResult(readHealthResponseSchema)(
            body,
          );
          return Result.isSuccess(health)
            ? { kind: 'answered', environmentId: health.success.environmentId }
            : { kind: 'foreign' };
        }),
      };
    }),
  );
