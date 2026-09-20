import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { authenticate } from '../middlewares/authenticate.ts';
import { preventCaching } from '../middlewares/prevent-caching.ts';
import { listCommits } from './list-commits.ts';
import { readCommitFiles } from './read-commit-files.ts';

export async function commitHistoryRoutes(
  server: FastifyInstance,
  options: { application: Application },
) {
  server.addHook('onRequest', preventCaching);
  server.addHook('onRequest', authenticate(options));
  listCommits(server, options);
  readCommitFiles(server, options);
}
