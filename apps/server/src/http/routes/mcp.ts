import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { UnauthorizedError } from '../errors/unauthorized-error.ts';
import { createReviewMcpServer } from '../mcp/review-server.ts';
import { authenticate } from '../middlewares/authenticate.ts';
import { callerOf } from '../principal.ts';

export async function mcpRoutes(
  server: FastifyInstance,
  options: { application: Application; token: string },
) {
  server.addHook('onRequest', async (request) => {
    if (!request.headers.authorization) throw new UnauthorizedError();
  });
  // The agent door: a caller reaching it with the bearer token is an agent,
  // whatever it claims in a payload.
  server.addHook('onRequest', authenticate(options.token, { kind: 'agent' }));
  server.all(
    '/mcp',
    { bodyLimit: 6 * 1024 * 1024 + 4096 },
    async (request, reply) => {
      // Agent transport uses explicit bearer credentials, never browser sessions.
      if (request.headers.origin)
        return reply.code(403).send({
          error: 'Browser requests are not accepted by the agent endpoint.',
        });
      if (request.method !== 'POST')
        return reply.header('Allow', 'POST').code(405).send();
      const mcp = createReviewMcpServer(options.application, callerOf(request));
      const transport = new StreamableHTTPServerTransport({
        enableJsonResponse: true,
      });
      // SDK 1.x disagrees with its own Transport type under exactOptionalPropertyTypes.
      await mcp.connect(transport as Parameters<typeof mcp.connect>[0]);
      reply.hijack();
      reply.raw.setHeader('Cache-Control', 'no-store');
      try {
        await transport.handleRequest(request.raw, reply.raw, request.body);
      } finally {
        await mcp.close();
      }
    },
  );
}
