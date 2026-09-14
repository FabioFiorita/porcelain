import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from '@fastify/type-provider-zod';
import Fastify, { type FastifyInstance } from 'fastify';
import { openApplication } from '../app.ts';
import {
  absolutePathSchema,
  serverSettingsSchema,
} from '../config/server-settings.ts';
import { toErrorResponse } from './mappers/error-response.ts';
import { artifactRoutes } from './routes/artifacts.ts';
import { browserSessionRoutes } from './routes/browser-session.ts';
import { commentRoutes } from './routes/comments.ts';
import { commitHistoryRoutes } from './routes/commit-history.ts';
import { filePreferenceRoutes } from './routes/file-preferences.ts';
import { fileRoutes } from './routes/files.ts';
import { gitActionRoutes } from './routes/git-actions.ts';
import { gitInspectionRoutes } from './routes/git-inspection.ts';
import { healthRoute } from './routes/health.ts';
import { inventoryRoutes } from './routes/inventory.ts';
import { reviewEvidenceRoutes } from './routes/review-evidence.ts';
import { reviewLayerRoutes } from './routes/review-layers.ts';
import { reviewedFileRoutes } from './routes/reviewed-files.ts';
import { registerStaticFiles } from './static-files.ts';

type ServerOptions = Parameters<typeof openApplication>[0] & {
  token: string;
  webRoot?: string;
};

function registerApiRoutes(
  server: FastifyInstance,
  options: {
    application: Awaited<ReturnType<typeof openApplication>>;
    token: string;
  },
) {
  server.register(browserSessionRoutes, options);
  server.register(healthRoute);
  server.register(gitActionRoutes, options);
  server.register(artifactRoutes, options);
  server.register(reviewLayerRoutes, options);
  server.register(reviewEvidenceRoutes, options);
  server.register(reviewedFileRoutes, options);
  server.register(commentRoutes, options);
  server.register(filePreferenceRoutes, options);
  server.register(fileRoutes, options);
  server.register(inventoryRoutes, options);
  server.register(commitHistoryRoutes, options);
  server.register(gitInspectionRoutes, options);
}

export async function createServer(options: ServerOptions) {
  const {
    token: configuredToken,
    webRoot: configuredWebRoot,
    ...applicationOptions
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
  const application = await openApplication(applicationOptions);
  server.addHook('preClose', async () => application.close());
  server.addHook('onClose', async () => application.close());
  const apiOptions = { application, token };
  registerApiRoutes(server, apiOptions);
  server.register(
    async (api) => {
      registerApiRoutes(api, apiOptions);
    },
    { prefix: '/api' },
  );
  if (webRoot !== undefined) registerStaticFiles(server, { webRoot });
  return server;
}
