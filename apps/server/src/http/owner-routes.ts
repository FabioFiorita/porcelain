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

/**
 * Owner operations, served only on the local socket. Reaching this listener
 * means passing the data directory's permissions, so nothing here re-checks a
 * credential — and nothing on the network can issue or revoke a pairing.
 */
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
  // The agent door. Reaching the socket proves file access, but authorship
  // needs the caller to be an agent, so this route says so explicitly rather
  // than inheriting the owner principal the listener assigns.
  server.all(
    '/mcp',
    { bodyLimit: 6 * 1024 * 1024 + 4096 },
    async (request, reply) => {
      if (request.method !== 'POST')
        return reply.header('Allow', 'POST').code(405).send();
      const mcp = createReviewMcpServer(options.application, { kind: 'agent' });
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
