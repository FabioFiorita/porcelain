import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from '@fastify/type-provider-zod';
import Fastify from 'fastify';
import { openApplication } from '../app.ts';
import { serverSettingsSchema } from '../config/server-settings.ts';
import { toErrorResponse } from './mappers/error-response.ts';
import { healthRoute } from './routes/health.ts';
import { inventoryRoutes } from './routes/inventory.ts';

export async function createServer(
  options: Parameters<typeof openApplication>[0] & { token: string },
) {
  const { token } = serverSettingsSchema.parse(options);
  const application = await openApplication(options);
  const server = Fastify().withTypeProvider<ZodTypeProvider>();
  server.setValidatorCompiler(validatorCompiler);
  server.setSerializerCompiler(serializerCompiler);
  server.setErrorHandler(async (error, _request, reply) => {
    const response = toErrorResponse(error);
    if (response.statusCode === 401) reply.header('WWW-Authenticate', 'Bearer');
    return reply.code(response.statusCode).send(response.body);
  });
  server.addHook('preClose', async () => application.close());
  server.addHook('onClose', async () => application.close());
  server.register(healthRoute);
  server.register(inventoryRoutes, { application, token });
  return server;
}
