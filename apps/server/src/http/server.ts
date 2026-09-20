import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from '@fastify/type-provider-zod';
import Fastify, { type FastifyInstance } from 'fastify';
import { openApplication } from '../app.ts';
import type { Principal } from '../models/principal.ts';

declare module 'fastify' {
  interface FastifyRequest {
    /** Aborts when the client goes away, so queued work can be dropped. */
    disconnected: AbortSignal;
    /** Who is calling, decided by the door this request arrived through. */
    principal: Principal;
  }
  interface FastifyInstance {
    /** Resolves once the first refresh at startup has settled. */
    refreshed(): Promise<void>;
  }
}

import type { Application } from '../application.ts';
import {
  absolutePathSchema,
  serverSettingsSchema,
} from '../config/server-settings.ts';
import { toErrorResponse } from './mappers/error-response.ts';
import {
  checkRequestOrigin,
  type OriginPolicy,
} from './middlewares/request-origin.ts';
import { artifactRoutes } from './routes/artifacts.ts';
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
import { mcpRoutes } from './routes/mcp.ts';
import { reviewEvidenceRoutes } from './routes/review-evidence.ts';
import { reviewLayerRoutes } from './routes/review-layers.ts';
import { reviewedFileRoutes } from './routes/reviewed-files.ts';
import { registerStaticFiles } from './static-files.ts';

export type NetworkServerOptions = {
  application: Application;
  token: string;
  webRoot?: string;
} & Partial<OriginPolicy>;

type ServerOptions = Parameters<typeof openApplication>[0] & {
  token: string;
  webRoot?: string;
} & Partial<OriginPolicy>;

function registerApiRoutes(
  server: FastifyInstance,
  options: { application: Application; token: string },
) {
  server.register(browserSessionRoutes, options);
  server.register(healthRoute);
  server.register(gitActionRoutes, options);
  server.register(commitDraftRoutes, options);
  server.register(artifactRoutes, options);
  server.register(reviewLayerRoutes, options);
  server.register(reviewEvidenceRoutes, options);
  server.register(reviewedFileRoutes, options);
  server.register(commentRoutes, options);
  server.register(mcpRoutes, options);
  server.register(filePreferenceRoutes, options);
  server.register(fileRoutes, options);
  server.register(inventoryRoutes, options);
  server.register(commitHistoryRoutes, options);
  server.register(gitInspectionRoutes, options);
}

/**
 * The network listener: viewers and agents, everything under one `/api`
 * prefix.  It does not own the application's lifetime — the runtime that
 * builds both listeners closes the application exactly once, so closing this
 * one cannot pull the database out from under the owner socket.
 */
export function createNetworkServer(options: NetworkServerOptions) {
  const {
    application,
    token: configuredToken,
    webRoot: configuredWebRoot,
    allowedHosts = [],
  } = options;
  const { token } = serverSettingsSchema.parse({ token: configuredToken });
  const webRoot =
    configuredWebRoot === undefined
      ? undefined
      : absolutePathSchema.parse(configuredWebRoot);
  const server = Fastify().withTypeProvider<ZodTypeProvider>();
  server.setValidatorCompiler(validatorCompiler);
  server.setSerializerCompiler(serializerCompiler);
  server.setErrorHandler(async (error, _request, reply) => {
    const response = toErrorResponse(error);
    if (response.statusCode === 401) reply.header('WWW-Authenticate', 'Bearer');
    return reply.code(response.statusCode).send(response.body);
  });
  // One disconnect signal per request, so an abandoned request is removed
  // from its lane instead of running for a client that has gone.
  server.decorateRequest('disconnected');
  // Every request carries a principal; each door sets its own.
  server.decorateRequest('principal');
  server.addHook('onRequest', (request, reply, done) => {
    // Anonymous until a door's authentication hook says otherwise. Public
    // routes never run one, so this is the value they keep.
    request.principal = { kind: 'anonymous' };
    const controller = new AbortController();
    request.disconnected = controller.signal;
    // Only the response socket closing means the client has gone; a request
    // body stream ends on every ordinary request.
    reply.raw.on('close', () => {
      if (!reply.raw.writableEnded)
        controller.abort(
          new DOMException('The request was abandoned', 'AbortError'),
        );
    });
    done();
  });
  // Before anything reads the request: a page in the owner's browser must not
  // be able to reach this server by name, or write across origins.
  server.addHook('onRequest', checkRequestOrigin({ allowedHosts }));
  // The server listens without waiting for any repository; this lets a caller
  // that needs the settled inventory wait for the first refresh explicitly.
  server.decorate('refreshed', () => application.ready());
  server.register(
    async (api) => {
      registerApiRoutes(api, { application, token });
    },
    { prefix: '/api' },
  );
  if (webRoot !== undefined) registerStaticFiles(server, { webRoot });
  return server;
}

/**
 * A network listener that opens and owns its own application.  The composite
 * runtime does not use this; it exists for callers that want one listener and
 * nothing else, which is every test and the server lab.
 */
export async function createServer(options: ServerOptions) {
  const { token, webRoot, allowedHosts, ...applicationOptions } = options;
  const application = await openApplication(applicationOptions);
  const server = createNetworkServer({
    application,
    token,
    ...(webRoot === undefined ? {} : { webRoot }),
    ...(allowedHosts === undefined ? {} : { allowedHosts }),
  });
  server.addHook('preClose', async () => application.close());
  server.addHook('onClose', async () => application.close());
  return server;
}
