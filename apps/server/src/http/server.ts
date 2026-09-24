import sensible from '@fastify/sensible';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from '@fastify/type-provider-zod';
import websocket from '@fastify/websocket';
import type { Principal } from '@porcelain/contracts/access';
import Fastify from 'fastify';
import { FilesystemWebRootFiles } from '../adapters/web/filesystem-web-root-files.ts';
import type { ServerApplication } from '../bootstrap/compose-server.ts';
import { liveUpdateMessageLimit } from '../config/request-limits.ts';
import { absolutePathSchema } from '../config/server-settings.ts';
import { handleError } from './error-handler.ts';
import { checkRequestOrigin } from './hooks/request-origin.ts';
import { readReviewSummaryPage } from './routes/reviews/read-review-summary-page.ts';
import { pairedScope } from './scopes/paired.ts';
import { publicScope } from './scopes/public.ts';
import { staticFiles } from './static-files.ts';

declare module 'fastify' {
  interface FastifyRequest {
    disconnected: AbortSignal;
    principal: Principal;
  }
}

export type NetworkServerOptions = {
  application: ServerApplication;
  webRoot?: string | undefined;
  allowedHosts?: readonly string[] | undefined;
};

export function createNetworkServer(options: NetworkServerOptions) {
  const { application, allowedHosts = [] } = options;
  const webRoot =
    options.webRoot === undefined
      ? undefined
      : absolutePathSchema.parse(options.webRoot);
  const server = Fastify().withTypeProvider<ZodTypeProvider>();
  server.setValidatorCompiler(validatorCompiler);
  server.setSerializerCompiler(serializerCompiler);
  server.setErrorHandler(handleError);
  server.register(sensible);
  server.register(websocket, {
    options: { maxPayload: liveUpdateMessageLimit },
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
  server.addHook(
    'onRequest',
    checkRequestOrigin({
      access: application.access,
      allowedHosts,
    }),
  );
  server.register(
    async (api) => {
      api.register(publicScope, { application, allowedHosts });
      api.register(pairedScope, { application });
    },
    { prefix: '/api' },
  );
  server.register(readReviewSummaryPage, {
    useCase: application.reviews.readReviewSummary,
  });
  if (webRoot !== undefined)
    server.register(staticFiles, {
      files: new FilesystemWebRootFiles(webRoot),
    });
  return server;
}
