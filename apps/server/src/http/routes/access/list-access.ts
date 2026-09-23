import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { listAccessResponseSchema } from '@porcelain/contracts/access';
import type { FastifyInstance } from 'fastify';
import type { ListAccessController } from '../../../controllers/list-access-controller.ts';
import { preventCaching } from '../../middlewares/prevent-caching.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export async function listAccess(
  server: FastifyInstance,
  options: { controller: Pick<ListAccessController, 'execute'> },
) {
  server.addHook('onRequest', preventCaching);
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/access',
    {
      schema: {
        response: { ...errorResponses, 200: listAccessResponseSchema },
      },
    },
    () => options.controller.execute({}, {}),
  );
}
