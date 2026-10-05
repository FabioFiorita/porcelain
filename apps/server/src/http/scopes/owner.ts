import type { Limits } from '../../config/limits.ts';
import type { FastifyInstance } from 'fastify';
import { mountEffectRoutes, type EffectRoutes } from '../effect-bridge.ts';
import { preventCaching } from '../hooks/prevent-caching.ts';
import type { ReviewMcpUseCases } from '../mcp/review-server.ts';
import { reviewMcp } from '../protocol/mcp.ts';

export type OwnerUseCases = ReviewMcpUseCases & {
  access: { routes: { owner: EffectRoutes } };
};

export async function ownerScope(
  server: FastifyInstance,
  options: {
    application: OwnerUseCases;
    limits: Limits;
  },
) {
  const { application } = options;
  server.addHook('onRequest', preventCaching);
  server.register(mountEffectRoutes, {
    routes: application.access.routes.owner,
  });
  server.register(reviewMcp, {
    useCases: application,
    limits: options.limits.http,
  });
}
