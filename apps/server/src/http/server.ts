import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from '@fastify/type-provider-zod';
import Fastify from 'fastify';
import { openApplication } from '../app.ts';
import { serverSettingsSchema } from '../config/server-settings.ts';
import { toErrorResponse } from './mappers/error-response.ts';
import { artifactRoutes } from './routes/artifacts.ts';
import { commentRoutes } from './routes/comments.ts';
import { commitHistoryRoutes } from './routes/commit-history.ts';
import { filePreferenceRoutes } from './routes/file-preferences.ts';
import { fileRoutes } from './routes/files.ts';
import { gitActionRoutes } from './routes/git-actions.ts';
import { gitInspectionRoutes } from './routes/git-inspection.ts';
import { healthRoute } from './routes/health.ts';
import { inventoryRoutes } from './routes/inventory.ts';
import { reviewLayerRoutes } from './routes/review-layers.ts';

export async function createServer(
  options: Parameters<typeof openApplication>[0] & {
    token: string;
  },
) {
  const { token } = serverSettingsSchema.parse(options);
  const server = Fastify().withTypeProvider<ZodTypeProvider>();
  server.setValidatorCompiler(validatorCompiler);
  server.setSerializerCompiler(serializerCompiler);
  server.setErrorHandler(async (error, _request, reply) => {
    const response = toErrorResponse(error);
    if (response.statusCode === 401) reply.header('WWW-Authenticate', 'Bearer');
    return reply.code(response.statusCode).send(response.body);
  });
  const application = await openApplication(options);
  server.addHook('preClose', async () => application.close());
  server.addHook('onClose', async () => application.close());
  server.register(healthRoute);
  server.register(gitActionRoutes, { application, token });
  server.register(artifactRoutes, { application, token });
  server.register(reviewLayerRoutes, { application, token });
  server.register(commentRoutes, { application, token });
  server.register(filePreferenceRoutes, { application, token });
  server.register(fileRoutes, { application, token });
  server.register(inventoryRoutes, { application, token });
  server.register(commitHistoryRoutes, { application, token });
  server.register(gitInspectionRoutes, { application, token });
  return server;
}
