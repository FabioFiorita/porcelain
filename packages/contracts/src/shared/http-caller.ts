import { Context, Schema } from 'effect';
import { HttpApiMiddleware } from 'effect/http-api';
import type { Principal } from '../access/principal.ts';
import { principalSchema } from '../access/principal.ts';
import { deviceRouteSchema } from '../access/pairing.ts';

const requestConnectionSchema = Schema.Struct({
  route: deviceRouteSchema,
  local: Schema.Boolean,
});

export class RequestConnection extends Context.Service<
  RequestConnection,
  typeof requestConnectionSchema.Type
>()('@porcelain/http/RequestConnection') {
  static readonly schema = requestConnectionSchema;
}

export class ClientRequest extends HttpApiMiddleware.Service<
  ClientRequest,
  { provides: RequestConnection }
>()('@porcelain/http/ClientRequest') {}

export class RequestCaller extends Context.Service<RequestCaller, Principal>()(
  '@porcelain/http/RequestCaller',
) {
  static readonly schema = principalSchema;
}

export class PairedRequest extends HttpApiMiddleware.Service<
  PairedRequest,
  { provides: RequestCaller }
>()('@porcelain/http/PairedRequest') {}
