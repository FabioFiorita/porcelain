import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from '@fastify/type-provider-zod';
import websocket from '@fastify/websocket';
import Fastify, { type FastifyInstance } from 'fastify';
import { openApplication } from '../app.ts';
import type { Principal } from '../models/principal.ts';

declare module 'fastify' {
  interface FastifyRequest {
    disconnected: AbortSignal;
    principal: Principal;
  }
  interface FastifyInstance {
    refreshed(): Promise<void>;
  }
}

import type { Application } from '../application.ts';
import { absolutePathSchema } from '../config/server-settings.ts';
import { toErrorResponse } from './mappers/error-response.ts';
import {
  checkRequestOrigin,
  type OriginPolicy,
} from './middlewares/request-origin.ts';
import { browserSessionRoutes } from './routes/browser-session.ts';
import { commentRoutes } from './routes/comments.ts';
import { commitDraftRoutes } from './routes/commit-drafts.ts';
import { commitHistoryRoutes } from './routes/commit-history.ts';
import { filePreferenceRoutes } from './routes/file-preferences.ts';
import { fileRoutes } from './routes/files.ts';
import { gitActionRoutes } from './routes/git-actions.ts';
import { gitInspectionRoutes } from './routes/git-inspection.ts';
import { healthRoute } from './routes/health.ts';
import { inventoryRoutes } from './routes/inventory.ts';
import { liveUpdateRoutes } from './routes/live-updates.ts';
import { pairRoutes } from './routes/pair.ts';
import { publishedReviewRoutes } from './routes/published-review.ts';
import { changeRoutes } from './routes/read-changes.ts';
import { reviewSummaryRoute } from './routes/review-summary.ts';
import { reviewedFileRoutes } from './routes/reviewed-files.ts';
import { reviewedLayerRoutes } from './routes/reviewed-layers.ts';
import { registerStaticFiles } from './static-files.ts';

export type NetworkServerOptions = {
  application: Application;
  webRoot?: string;
} & Partial<OriginPolicy>;

type ServerOptions = Parameters<typeof openApplication>[0] & {
  webRoot?: string;
} & Partial<OriginPolicy>;

function registerApiRoutes(
  server: FastifyInstance,
  options: { application: Application } & OriginPolicy,
) {
  server.register(liveUpdateRoutes, options);
  server.register(browserSessionRoutes, options);
  server.register(healthRoute, options);
  server.register(pairRoutes, options);
  server.register(gitActionRoutes, options);
  server.register(commitDraftRoutes, options);
  server.register(changeRoutes, options);
  server.register(reviewedFileRoutes, options);
  server.register(reviewedLayerRoutes, options);
  server.register(publishedReviewRoutes, options);
  server.register(commentRoutes, options);
  server.register(filePreferenceRoutes, options);
  server.register(fileRoutes, options);
  server.register(inventoryRoutes, options);
  server.register(commitHistoryRoutes, options);
  server.register(gitInspectionRoutes, options);
}

export function createNetworkServer(options: NetworkServerOptions) {
  const {
    application,
    webRoot: configuredWebRoot,
    allowedHosts = [],
  } = options;
  const webRoot =
    configuredWebRoot === undefined
      ? undefined
      : absolutePathSchema.parse(configuredWebRoot);
  const server = Fastify().withTypeProvider<ZodTypeProvider>();
  server.setValidatorCompiler(validatorCompiler);
  server.setSerializerCompiler(serializerCompiler);
  server.register(websocket, { options: { maxPayload: 64 * 1024 } });
  server.setErrorHandler(async (error, _request, reply) => {
    const response = toErrorResponse(error);
    if (response.statusCode === 401) reply.header('WWW-Authenticate', 'Bearer');
    return reply.code(response.statusCode).send(response.body);
  });
  server.decorateRequest('disconnected');
  server.decorateRequest('principal');
  server.addHook('onRequest', (request, reply, done) => {
    request.principal = { kind: 'anonymous' };
    const controller = new AbortController();
    request.disconnected = controller.signal;
    reply.raw.on('close', () => {
      if (!reply.raw.writableEnded)
        controller.abort(
          new DOMException('The request was abandoned', 'AbortError'),
        );
    });
    done();
  });
  server.addHook('onRequest', checkRequestOrigin({ allowedHosts }));
  server.decorate('refreshed', () => application.ready());
  server.register(
    async (api) => {
      registerApiRoutes(api, { application, allowedHosts });
    },
    { prefix: '/api' },
  );
  reviewSummaryRoute(server, { application });
  if (webRoot !== undefined) registerStaticFiles(server, { webRoot });
  return server;
}

export async function createServer(options: ServerOptions) {
  const { webRoot, allowedHosts, ...applicationOptions } = options;
  const application = await openApplication(applicationOptions);
  const server = createNetworkServer({
    application,
    ...(webRoot === undefined ? {} : { webRoot }),
    ...(allowedHosts === undefined ? {} : { allowedHosts }),
  });
  server.addHook('preClose', async () => application.close());
  server.addHook('onClose', async () => application.close());
  return Object.assign(server, { application });
}
