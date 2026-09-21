import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { authenticate } from '../middlewares/authenticate.ts';
import { preventCaching } from '../middlewares/prevent-caching.ts';
import { dismissInterruptedGitAction } from './dismiss-interrupted-git-action.ts';
import { getGitActionReceipt } from './get-git-action-receipt.ts';
import { listGitBranches } from './list-git-branches.ts';
import { runGitAction } from './run-git-action.ts';

export async function gitActionRoutes(
  server: FastifyInstance,
  options: { application: Application },
) {
  server.addHook('onRequest', authenticate(options));
  server.addHook('onSend', preventCaching);
  runGitAction(server, options);
  listGitBranches(server, options);
  getGitActionReceipt(server, options);
  dismissInterruptedGitAction(server, options);
}
