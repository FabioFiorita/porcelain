import { httpErrors } from '@fastify/sensible';
import {
  RequestCaller,
  PairedRequest,
  ClientRequest,
  RequestConnection,
} from '@porcelain/contracts/shared';
import { Context, Effect, Layer, Schema } from 'effect';
import { HttpRouter, HttpServer, HttpServerResponse } from 'effect/http';
import {
  HttpApi,
  HttpApiError,
  type HttpApiGroup,
  type HttpApiEndpoint,
} from 'effect/http-api';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

class Unanswered extends Context.Service<
  Unanswered,
  { readonly reject: (error: unknown) => void }
>()('@porcelain/server/Unanswered') {}

function fastifyBoundaryError(defect: unknown): unknown {
  if (!HttpApiError.HttpApiSchemaError.is(defect)) return defect;
  return defect.kind === 'Body' || defect.kind === 'ResponseHeaders'
    ? defect
    : httpErrors.badRequest('Invalid request');
}

const handOver = HttpRouter.middleware(
  (app) =>
    Effect.catchDefect(app, (defect) =>
      Effect.flatMap(Effect.serviceOption(Unanswered), (unanswered) => {
        if (unanswered._tag === 'Some')
          unanswered.value.reject(fastifyBoundaryError(defect));
        return Effect.succeed(HttpServerResponse.empty({ status: 500 }));
      }),
    ),
  { global: true },
);

type Endpoint = Pick<HttpApiEndpoint.Top, 'method' | 'path' | 'identifier'>;

export type EffectRoutes = {
  readonly endpoints: readonly Endpoint[];
  readonly answer: (
    request: Request,
    context: Context.Context<never>,
  ) => Promise<Response>;
  readonly bodyLimits: Readonly<Record<string, number>>;
  readonly dispose: () => Promise<void>;
};

export function effectRoutes<
  Id extends string,
  Groups extends HttpApiGroup.Constraint,
>(
  api: HttpApi.HttpApi<Id, Groups>,
  routes: Layer.Layer<
    never,
    never,
    | HttpRouter.HttpRouter
    | Layer.Success<typeof HttpServer.layerServices>
    | PairedRequest
    | ClientRequest
  >,
  bodyLimits: Readonly<Record<string, number>> = {},
): EffectRoutes {
  const { handler, dispose } = HttpRouter.toWebHandler(
    Layer.mergeAll(routes, handOver).pipe(
      Layer.provide(
        Layer.succeed(ClientRequest, (httpEffect) =>
          Effect.flatMap(
            Effect.serviceOption(RequestConnection),
            (connection) =>
              connection._tag === 'Some' &&
              Schema.is(RequestConnection.schema)(connection.value)
                ? Effect.provideService(
                    httpEffect,
                    RequestConnection,
                    connection.value,
                  )
                : Effect.die(
                    new Error(
                      'A client route requires an identified connection',
                    ),
                  ),
          ),
        ),
      ),
      Layer.provide(
        Layer.succeed(PairedRequest, (httpEffect) =>
          Effect.flatMap(Effect.serviceOption(RequestCaller), (caller) =>
            caller._tag === 'Some' &&
            Schema.is(RequestCaller.schema)(caller.value)
              ? Effect.provideService(httpEffect, RequestCaller, caller.value)
              : Effect.die(
                  new Error('A paired route requires an authenticated caller'),
                ),
          ),
        ),
      ),
      Layer.provide(HttpServer.layerServices),
    ),
    { disableLogger: true },
  );
  const endpoints: Endpoint[] = [];
  HttpApi.reflect(api, {
    onGroup: () => undefined,
    onEndpoint: ({ endpoint }) =>
      endpoints.push({
        method: endpoint.method,
        path: endpoint.path,
        identifier: endpoint.identifier,
      }),
  });
  return { endpoints, answer: handler, bodyLimits, dispose };
}

async function answer(
  routes: EffectRoutes,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  request.disconnected.throwIfAborted();
  let rejected: { error: unknown } | undefined;
  const contentType = request.headers['content-type'];
  let context: Context.Context<never> = Context.make(Unanswered, {
    reject: (error) => {
      rejected = { error };
    },
  });
  if (request.principal !== undefined)
    context = Context.add(context, RequestCaller, request.principal);
  if (request.client !== undefined)
    context = Context.add(context, RequestConnection, {
      route: request.client.route,
      local: request.local,
    });
  const response = await routes.answer(
    new Request(new URL(request.url, 'http://porcelain.invalid'), {
      method: request.method,
      headers: contentType === undefined ? {} : { 'content-type': contentType },
      body: typeof request.body === 'string' ? request.body : null,
      signal: request.disconnected,
    }),
    context,
  );
  request.disconnected.throwIfAborted();
  if (rejected !== undefined) throw rejected.error;
  const responseType = response.headers.get('content-type');
  const body = await response.text();
  return reply
    .code(response.status)
    .header('content-type', responseType)
    .send(
      responseType?.startsWith('application/json') ? JSON.parse(body) : body,
    );
}

export async function mountEffectRoutes(
  server: FastifyInstance,
  options: { routes: EffectRoutes },
) {
  const { routes } = options;
  server.removeAllContentTypeParsers();
  server.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (_request, body, done) => done(null, body),
  );
  for (const endpoint of routes.endpoints)
    server.route({
      method: endpoint.method,
      url: endpoint.path.replace(/^\/api/, ''),
      ...(routes.bodyLimits[endpoint.identifier] === undefined
        ? {}
        : { bodyLimit: routes.bodyLimits[endpoint.identifier] }),
      handler: (request, reply) => answer(routes, request, reply),
    });
}
