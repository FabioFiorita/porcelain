import { requestBody, requestBodyLimit } from '../hooks/request-body.ts';
import { handlerAudit } from '../diagnostics.ts';
import { ReviewMcpApi } from '@porcelain/contracts/access';
import { McpProtocol, McpServer } from 'effect/ai';
import { Effect, Layer } from 'effect';
import { HttpRouter, HttpServerRequest, HttpServerResponse } from 'effect/http';
import type { Limits } from '../../config/limits.ts';
import { RequestError } from '../../runtime/errors/request-error.ts';
import {
  reviewMcpHandlers,
  type ReviewMcpUseCases,
} from '../mcp/review-server.ts';

const endpoint = ReviewMcpApi.groups.reviewMcp.endpoints.reviewMcp;
const invocationPolicy = HttpRouter.middleware((app) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    if (request.method !== endpoint.method)
      return HttpServerResponse.jsonUnsafe(
        {
          statusCode: 405,
          error: 'Method Not Allowed',
          message: 'Method Not Allowed',
        },
        { status: 405, headers: { allow: 'POST' } },
      );
    const cwd = request.headers['x-porcelain-cwd'];
    if (cwd === undefined || cwd === '')
      return yield* Effect.die(
        new RequestError({
          statusCode: 400,
          message: 'The x-porcelain-cwd header is required',
        }),
      );
    return yield* app;
  }),
);

export function reviewMcp(options: {
  useCases: ReviewMcpUseCases;
  limits: Limits['http'];
}) {
  return Layer.mergeAll(
    reviewMcpHandlers(options.useCases),
    McpServer.layerHttp({
      name: 'porcelain',
      version: '1.0.0',
      path: endpoint.path,
      instructions:
        'Publish and discuss the review for the registered worktree containing this MCP process cwd. Read porcelain://review-guide before publishing. Shell and editor tools remain the source for reading code.',
      protocols: [
        McpProtocol.v2026_07_28,
        McpProtocol.v2025_11_25,
        McpProtocol.v2025_06_18,
        McpProtocol.v2025_03_26,
        McpProtocol.v2024_11_05,
      ],
    }).pipe(Layer.orDie),
  ).pipe(
    Layer.provide(requestBody.layer),
    Layer.provide(requestBodyLimit(endpoint, options.limits.reviewBodyBytes)),
    Layer.provide(invocationPolicy.combine(handlerAudit).layer),
  );
}
