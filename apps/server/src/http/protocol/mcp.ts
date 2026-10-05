import { ReviewMcpApi } from '@porcelain/contracts/access';
import { httpErrors } from '@fastify/sensible';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { Limits } from '../../config/limits.ts';
import {
  createReviewMcpServer,
  type ReviewMcpUseCases,
} from '../mcp/review-server.ts';

function asTransport(transport: StreamableHTTPServerTransport): Transport {
  const connection: Transport = {
    start: () => transport.start(),
    send: (message, options) => transport.send(message, options),
    close: () => transport.close(),
  };
  transport.onclose = () => connection.onclose?.();
  transport.onerror = (error) => connection.onerror?.(error);
  transport.onmessage = (message, extra) =>
    connection.onmessage?.(message, extra);
  return connection;
}

function keepHookHeaders(reply: FastifyReply) {
  for (const [name, value] of Object.entries(reply.getHeaders()))
    if (value !== undefined) reply.raw.setHeader(name, value);
}

export function reviewMcp(
  server: FastifyInstance,
  options: { useCases: ReviewMcpUseCases; limits: Limits['http'] },
) {
  server.all(
    ReviewMcpApi.groups.reviewMcp.endpoints.reviewMcp.path,
    {
      bodyLimit: options.limits.reviewBodyBytes,
    },
    async (request, reply) => {
      if (
        request.method !==
        ReviewMcpApi.groups.reviewMcp.endpoints.reviewMcp.method
      ) {
        reply.header(
          'Allow',
          ReviewMcpApi.groups.reviewMcp.endpoints.reviewMcp.method,
        );
        throw httpErrors.methodNotAllowed();
      }
      const cwd = request.headers['x-porcelain-cwd'];
      if (typeof cwd !== 'string' || cwd === '')
        throw httpErrors.badRequest('The x-porcelain-cwd header is required');
      const mcp = createReviewMcpServer(options.useCases, cwd);
      const transport = new StreamableHTTPServerTransport({
        enableJsonResponse: true,
      });
      await mcp.connect(asTransport(transport));
      reply.hijack();
      keepHookHeaders(reply);
      try {
        await transport.handleRequest(request.raw, reply.raw, request.body);
      } finally {
        await mcp.close();
      }
    },
  );
}
