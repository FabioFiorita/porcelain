import type { FastifyInstance } from 'fastify';
import type { IssuePairingUseCase } from '../../use-cases/access/issue-pairing.ts';
import type { ListAccessUseCase } from '../../use-cases/access/list-access.ts';
import type { ReadOwnerStatusUseCase } from '../../use-cases/access/read-owner-status.ts';
import type { RevokeAccessUseCase } from '../../use-cases/access/revoke-access.ts';
import { preventCaching } from '../hooks/prevent-caching.ts';
import type { ReviewMcpUseCases } from '../mcp/review-server.ts';
import { reviewMcp } from '../protocol/mcp.ts';
import { issuePairing } from '../routes/access/issue-pairing.ts';
import { listAccess } from '../routes/access/list-access.ts';
import { readOwnerStatus } from '../routes/access/read-owner-status.ts';
import { revokeAccess } from '../routes/access/revoke-access.ts';

export type OwnerUseCases = ReviewMcpUseCases & {
  access: {
    issuePairing: Pick<IssuePairingUseCase, 'execute'>;
    listAccess: Pick<ListAccessUseCase, 'execute'>;
    readOwnerStatus: Pick<ReadOwnerStatusUseCase, 'execute'>;
    revokeAccess: Pick<RevokeAccessUseCase, 'execute'>;
  };
};

export async function ownerScope(
  server: FastifyInstance,
  options: { application: OwnerUseCases },
) {
  const { application } = options;
  server.addHook('onRequest', preventCaching);
  server.register(readOwnerStatus, {
    useCase: application.access.readOwnerStatus,
  });
  server.register(issuePairing, {
    useCase: application.access.issuePairing,
  });
  server.register(listAccess, {
    useCase: application.access.listAccess,
  });
  server.register(revokeAccess, {
    useCase: application.access.revokeAccess,
  });
  server.register(reviewMcp, { useCases: application });
}
