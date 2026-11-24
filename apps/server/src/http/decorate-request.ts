import { Inspectable } from 'effect';
import { HttpIncomingMessage, HttpServerRequest } from 'effect/http';

type Request = HttpServerRequest.HttpServerRequest;
type RequestParts = Pick<
  Request,
  | 'upgrade'
  | 'upgradeWith'
  | 'text'
  | 'json'
  | 'urlParamsBody'
  | 'arrayBuffer'
  | 'stream'
  | 'multipart'
  | 'multipartStream'
>;

export function decorateRequest(
  request: Request,
  project: (current: Request) => Partial<RequestParts>,
): Request {
  return HttpServerRequest.HttpServerRequest.of({
    [HttpServerRequest.TypeId]: HttpServerRequest.TypeId,
    [HttpIncomingMessage.TypeId]: HttpIncomingMessage.TypeId,
    source: request.source,
    url: request.url,
    originalUrl: request.originalUrl,
    method: request.method,
    headers: request.headers,
    cookies: request.cookies,
    remoteAddress: request.remoteAddress,
    peerAddress: request.peerAddress,
    protocol: request.protocol,
    upgrade: request.upgrade,
    upgradeWith: (options) => request.upgradeWith(options),
    text: request.text,
    json: request.json,
    urlParamsBody: request.urlParamsBody,
    arrayBuffer: request.arrayBuffer,
    stream: request.stream,
    multipart: request.multipart,
    multipartStream: request.multipartStream,
    ...project(request),
    modify: (options) => decorateRequest(request.modify(options), project),
    toJSON: () => request.toJSON(),
    toString: () => request.toString(),
    [Inspectable.NodeInspectSymbol]: () => request.toJSON(),
  });
}
