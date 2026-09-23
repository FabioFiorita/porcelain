import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  issuePairingRequestSchema,
  issuePairingResponseSchema,
  listAccessResponseSchema,
  revokeAccessRequestSchema,
  revokeAccessResponseSchema,
} from '@porcelain/contracts/access';
import type { FastifyInstance } from 'fastify';
import type { IssuePairingController } from '../controllers/issue-pairing-controller.ts';
import type { ListAccessController } from '../controllers/list-access-controller.ts';
import type { RevokeAccessController } from '../controllers/revoke-access-controller.ts';
import type { ReadInventoryController } from '../controllers/read-inventory-controller.ts';
import type { PublishReviewController } from '../controllers/publish-review-controller.ts';
import type { ReadPublishedReviewController } from '../controllers/read-published-review-controller.ts';
import type { CreateCommentThreadController } from '../controllers/create-comment-thread-controller.ts';
import type { ListCommentThreadsController } from '../controllers/list-comment-threads-controller.ts';
import type { ReplyToCommentController } from '../controllers/reply-to-comment-controller.ts';
import type { ResolveCommentThreadController } from '../controllers/resolve-comment-thread-controller.ts';
import { createReviewMcpServer } from './mcp/review-server.ts';
import { errorResponses } from './schemas/error-responses.ts';

export function registerOwnerRoutes(
  server: FastifyInstance,
  options: {
    issuePairingController: Pick<IssuePairingController, 'execute'>;
    listAccessController: Pick<ListAccessController, 'execute'>;
    revokeAccessController: Pick<RevokeAccessController, 'execute'>;
    readInventoryController: Pick<ReadInventoryController, 'execute'>;
    publishReviewController: Pick<PublishReviewController, 'execute'>;
    readPublishedReviewController: Pick<
      ReadPublishedReviewController,
      'execute'
    >;
    listCommentThreadsController: Pick<ListCommentThreadsController, 'execute'>;
    createCommentThreadController: Pick<
      CreateCommentThreadController,
      'execute'
    >;
    replyToCommentController: Pick<ReplyToCommentController, 'execute'>;
    resolveCommentThreadController: Pick<
      ResolveCommentThreadController,
      'execute'
    >;
  },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.post(
    '/pairings',
    {
      schema: {
        body: issuePairingRequestSchema,
        response: { ...errorResponses, 200: issuePairingResponseSchema },
      },
    },
    async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      return options.issuePairingController.execute(request.body);
    },
  );
  api.get(
    '/access',
    {
      schema: {
        response: { ...errorResponses, 200: listAccessResponseSchema },
      },
    },
    async (_request, reply) => {
      reply.header('Cache-Control', 'no-store');
      return options.listAccessController.execute();
    },
  );
  api.post(
    '/access/revoke',
    {
      schema: {
        body: revokeAccessRequestSchema,
        response: { ...errorResponses, 200: revokeAccessResponseSchema },
      },
    },
    async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      return options.revokeAccessController.execute(request.body);
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
      const mcp = createReviewMcpServer(options, { kind: 'agent' }, cwd);
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
