import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { authenticate } from '../middlewares/authenticate.ts';
import { preventCaching } from '../middlewares/prevent-caching.ts';
import { executeCommit } from './execute-commit.ts';
import { executeFetch } from './execute-fetch.ts';
import { executePush } from './execute-push.ts';
import { executeStashApply } from './execute-stash-apply.ts';
import { executeStashCreate } from './execute-stash-create.ts';
import { executeStashPop } from './execute-stash-pop.ts';
import { getGitActionReceipt } from './get-git-action-receipt.ts';
import { prepareCommit } from './prepare-commit.ts';
import { prepareFetch } from './prepare-fetch.ts';
import { preparePush } from './prepare-push.ts';
import { prepareStashApply } from './prepare-stash-apply.ts';
import { prepareStashCreate } from './prepare-stash-create.ts';
import { prepareStashPop } from './prepare-stash-pop.ts';

export async function gitActionRoutes(
  server: FastifyInstance,
  options: { application: Application; token: string },
) {
  server.addHook('onRequest', authenticate(options.token));
  server.addHook('onSend', preventCaching);
  prepareFetch(server, options);
  executeFetch(server, options);
  preparePush(server, options);
  executePush(server, options);
  prepareCommit(server, options);
  executeCommit(server, options);
  prepareStashCreate(server, options);
  executeStashCreate(server, options);
  prepareStashApply(server, options);
  executeStashApply(server, options);
  prepareStashPop(server, options);
  executeStashPop(server, options);
  getGitActionReceipt(server, options);
}
