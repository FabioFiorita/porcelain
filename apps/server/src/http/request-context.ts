import type { NodeHttpServerRequest } from '@effect/platform-node';
import type { Principal } from '@porcelain/contracts/access';
import {
  ClientRequest,
  PairedRequest,
  RequestCaller,
  RequestConnection,
} from '@porcelain/contracts/shared';
import { Context, Effect, Layer, Schema } from 'effect';
import type { HttpServerRequest } from 'effect/http';
import type { IdentifiedClient } from '../ports/identify-request-client-use-case-port.ts';

export class RequestContext extends Context.Service<
  RequestContext,
  {
    readonly requestId: string;
    readonly request: HttpServerRequest.HttpServerRequest;
    readonly incoming: ReturnType<
      typeof NodeHttpServerRequest.toIncomingMessage
    >;
    readonly response: ReturnType<
      typeof NodeHttpServerRequest.toServerResponse
    >;
    client: IdentifiedClient;
    principal: Principal | undefined;
    crossOrigin: boolean;
    local: boolean;
  }
>()('@porcelain/server/RequestContext') {}

export const requestServices = Layer.mergeAll(
  Layer.succeed(ClientRequest, (httpEffect) =>
    Effect.flatMap(Effect.serviceOption(RequestContext), (context) =>
      context._tag === 'Some'
        ? Effect.provideService(httpEffect, RequestConnection, {
            route: context.value.client.route,
            local: context.value.local,
          })
        : Effect.die(
            new Error('A client route requires an identified connection'),
          ),
    ),
  ),
  Layer.succeed(PairedRequest, (httpEffect) =>
    Effect.flatMap(Effect.serviceOption(RequestContext), (context) =>
      context._tag === 'Some' &&
      Schema.is(RequestCaller.schema)(context.value.principal)
        ? Effect.provideService(
            httpEffect,
            RequestCaller,
            context.value.principal,
          )
        : Effect.die(
            new Error('A paired route requires an authenticated caller'),
          ),
    ),
  ),
);
