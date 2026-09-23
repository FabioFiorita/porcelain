import type { FastifyInstance } from 'fastify';
import type { IssuePairingController } from '../../controllers/issue-pairing-controller.ts';
import type { ListAccessController } from '../../controllers/list-access-controller.ts';
import type { ReadOwnerStatusController } from '../../controllers/read-owner-status-controller.ts';
import type { RevokeAccessController } from '../../controllers/revoke-access-controller.ts';
import { preventCaching } from '../hooks/prevent-caching.ts';
import type { ReviewMcpControllers } from '../mcp/review-server.ts';
import { reviewMcp } from '../protocol/mcp.ts';
import { issuePairing } from '../routes/access/issue-pairing.ts';
import { listAccess } from '../routes/access/list-access.ts';
import { readOwnerStatus } from '../routes/access/read-owner-status.ts';
import { revokeAccess } from '../routes/access/revoke-access.ts';

export type OwnerControllers = ReviewMcpControllers & {
  readOwnerStatusController: Pick<ReadOwnerStatusController, 'execute'>;
  issuePairingController: Pick<IssuePairingController, 'execute'>;
  listAccessController: Pick<ListAccessController, 'execute'>;
  revokeAccessController: Pick<RevokeAccessController, 'execute'>;
};

export async function ownerScope(
  server: FastifyInstance,
  options: { application: OwnerControllers },
) {
  const { application } = options;
  server.addHook('onRequest', preventCaching);
  server.register(readOwnerStatus, {
    controller: application.readOwnerStatusController,
  });
  server.register(issuePairing, {
    controller: application.issuePairingController,
  });
  server.register(listAccess, {
    controller: application.listAccessController,
  });
  server.register(revokeAccess, {
    controller: application.revokeAccessController,
  });
  server.register(reviewMcp, { controllers: application });
}
