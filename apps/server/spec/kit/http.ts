import { request } from 'node:http';
import { LIMITS } from '../../src/config/limits.ts';
import { Context, Effect, Exit, Layer, Scope } from 'effect';
import type { Principal } from '@porcelain/contracts/access';
import type { HttpApplication } from '../../src/http/application.ts';
import {
  createHttpListener,
  requestBoundary,
} from '../../src/http/server-factory.ts';
import { requestPolicy } from '../../src/http/hooks/request-policy.ts';
import { Observability } from '../../src/runtime/observability.ts';

export async function openHttpApplication(
  application: HttpApplication,
  principal: Principal | undefined,
) {
  const scope = await Effect.runPromise(Scope.make());
  try {
    const context = await Effect.runPromise(
      Layer.build(Observability.layer).pipe(
        Effect.provideService(Scope.Scope, scope),
      ),
    );
    const observability = Context.get(context, Observability);
    const logger = { failure: () => undefined };
    const listener = createHttpListener({
      application: application.pipe(
        Layer.provide(
          requestPolicy(Effect.void).combine(
            requestBoundary({
              principal,
              logger,
              observability,
              bodyBytes: LIMITS.http.bodyBytes,
            }),
          ).layer,
        ),
      ),
      logger,
      principal,
      websocketMaxBytes: LIMITS.liveUpdates.messageBytes,
    });
    const address = await listener.listen({ host: '127.0.0.1', port: 0 });
    return {
      address,
      close: async () => {
        try {
          await listener.close();
        } finally {
          await Effect.runPromise(Scope.close(scope, Exit.void));
        }
      },
      sendChunks: (path: string, chunks: readonly string[]) =>
        new Promise<{ status: number; body: unknown }>((resolve, reject) => {
          const sending = request(
            new URL(path, address),
            {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                'transfer-encoding': 'chunked',
              },
            },
            (response) => {
              response.setEncoding('utf8');
              let text = '';
              response.on('data', (chunk: string) => {
                text += chunk;
              });
              response.once('error', reject);
              response.once('end', () =>
                resolve({
                  status: response.statusCode ?? 0,
                  body: JSON.parse(text),
                }),
              );
            },
          );
          sending.once('error', reject);
          for (const chunk of chunks) sending.write(chunk);
          sending.end();
        }),
      send: (input: {
        method: string;
        path: string;
        headers?: Record<string, string>;
        body?: unknown;
      }) =>
        fetch(new URL(input.path, address), {
          method: input.method,
          headers: { 'content-type': 'application/json', ...input.headers },
          ...(input.body === undefined
            ? {}
            : {
                body:
                  typeof input.body === 'string'
                    ? input.body
                    : JSON.stringify(input.body),
              }),
        }),
    };
  } catch (error) {
    await Effect.runPromise(Scope.close(scope, Exit.void));
    throw error;
  }
}
