import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from '@fastify/type-provider-zod';
import Fastify from 'fastify';
import { openApplication } from '../app.ts';
import { healthRoute } from './routes/health.ts';

export async function createServer(
  options: Parameters<typeof openApplication>[0],
) {
  const application = await openApplication(options);
  const server = Fastify().withTypeProvider<ZodTypeProvider>();
  server.setValidatorCompiler(validatorCompiler);
  server.setSerializerCompiler(serializerCompiler);
  server.addHook('onClose', async () => application.close());
  server.register(healthRoute);
  return server;
}
