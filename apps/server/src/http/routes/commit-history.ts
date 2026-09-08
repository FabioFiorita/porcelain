import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { authenticate } from '../middlewares/authenticate.ts';
import { preventCaching } from '../middlewares/prevent-caching.ts';
import { inspectCommitChanges } from './inspect-commit-changes.ts';
import { listCommits } from './list-commits.ts';

export async function commitHistoryRoutes(
  server: FastifyInstance,
  options: { application: Application; token: string },
) {
  server.addHook('onRequest', preventCaching);
  server.addHook('onRequest', authenticate(options.token));
  listCommits(server, options);
  inspectCommitChanges(server, options);
}
