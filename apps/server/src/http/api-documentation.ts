import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { jsonSchemaTransform } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';

export async function registerApiDocumentation(server: FastifyInstance) {
  await server.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'Porcelain API',
        version: '0.1.0',
        description:
          'Explore the review server using Try it out. Authorize with the bearer token supplied by your server operator. Start with GET /inventory, then copy a worktree ID into Files, Changes, History, or Comments. Project registration discovers existing worktrees; there is no worktree-creation endpoint. Git writes require preparation, execution with a new requestId, and polling the receipt until it finishes. Requests execute real operations on registered repositories.',
      },
      tags: [
        'Health',
        'Inventory',
        'Files',
        'Changes',
        'History',
        'File preferences',
        'Review layers',
        'Comments',
        'Artifacts',
        'Git actions',
      ].map((name) => ({ name })),
      components: {
        securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } },
      },
      security: [{ bearerAuth: [] }],
    },
    transform: jsonSchemaTransform,
  });
  await server.register(swaggerUi, {
    routePrefix: '/documentation',
    staticCSP: true,
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      displayRequestDuration: true,
      persistAuthorization: false,
      validatorUrl: null,
    },
  });
}
