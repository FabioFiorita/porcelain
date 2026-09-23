import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  accessListingSchema,
  issuedGrantsSchema,
  issueGrantsSchema,
  revokeAccessSchema,
  revokedAccessSchema,
} from '@porcelain/contracts/pairing';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../application.ts';
import { createReviewMcpServer } from './mcp/review-server.ts';
import { errorResponses } from './schemas/error-responses.ts';

export function registerOwnerRoutes(
  server: FastifyInstance,
  options: { application: Application },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.post(
    '/pairings',
    {
      schema: {
        body: issueGrantsSchema,
        response: { ...errorResponses, 200: issuedGrantsSchema },
      },
    },
    async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      const issued = await options.application.issuePairing(
        request.body.labels,
        request.body.addresses,
      );
      return {
        grants: issued.map(({ grant, code, link }) => ({
          ...grant,
          code,
          link,
        })),
      };
    },
  );
  api.get(
    '/access',
    { schema: { response: { ...errorResponses, 200: accessListingSchema } } },
    async (_request, reply) => {
      reply.header('Cache-Control', 'no-store');
      return options.application.listAccess();
    },
  );
  api.post(
    '/access/revoke',
    {
      schema: {
        body: revokeAccessSchema,
        response: { ...errorResponses, 200: revokedAccessSchema },
      },
    },
    async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      return options.application.revokeAccess(request.body.id);
    },
  );
  server.all(
    '/mcp',
    { bodyLimit: 6 * 1024 * 1024 + 4096 },
    async (request, reply) => {
      if (request.method !== 'POST')
        return reply.header('Allow', 'POST').code(405).send();
      const cwd =
        typeof request.headers['x-porcelain-cwd'] === 'string'
          ? request.headers['x-porcelain-cwd']
          : process.cwd();
      const mcp = createReviewMcpServer(
        options.application,
        { kind: 'agent' },
        cwd,
      );
      const transport = new StreamableHTTPServerTransport({
        enableJsonResponse: true,
      });
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
