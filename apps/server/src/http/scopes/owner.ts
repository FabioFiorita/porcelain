import type { Limits } from '../../config/limits.ts';
import type { FastifyInstance } from 'fastify';
import type { IssuePairingUseCase } from '../../use-cases/access/issue-pairing.ts';
import type { ListAccessUseCase } from '../../use-cases/access/list-access.ts';
import type { ReadOwnerStatusUseCase } from '../../use-cases/access/read-owner-status.ts';
import type { ReadRemoteAccessUseCase } from '../../use-cases/access/read-remote-access.ts';
import type { RevokeAccessUseCase } from '../../use-cases/access/revoke-access.ts';
import type { SetRemoteAccessUseCase } from '../../use-cases/access/set-remote-access.ts';
import { preventCaching } from '../hooks/prevent-caching.ts';
import type { ReviewMcpUseCases } from '../mcp/review-server.ts';
import { reviewMcp } from '../protocol/mcp.ts';
import { issuePairing } from '../routes/access/issue-pairing.ts';
import { listAccess } from '../routes/access/list-access.ts';
import { readOwnerStatus } from '../routes/access/read-owner-status.ts';
import { readRemoteAccess } from '../routes/access/read-remote-access.ts';
import { revokeAccess } from '../routes/access/revoke-access.ts';
import { setRemoteAccess } from '../routes/access/set-remote-access.ts';

export type OwnerUseCases = ReviewMcpUseCases & {
  access: {
    issuePairing: Pick<IssuePairingUseCase, 'execute'>;
    listAccess: Pick<ListAccessUseCase, 'execute'>;
    readOwnerStatus: Pick<ReadOwnerStatusUseCase, 'execute'>;
    readRemoteAccess: Pick<ReadRemoteAccessUseCase, 'execute'>;
    revokeAccess: Pick<RevokeAccessUseCase, 'execute'>;
    setRemoteAccess: Pick<SetRemoteAccessUseCase, 'execute'>;
  };
};

export async function ownerScope(
  server: FastifyInstance,
  options: { application: OwnerUseCases; limits: Limits },
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
  server.register(readRemoteAccess, {
    useCase: application.access.readRemoteAccess,
  });
  server.register(setRemoteAccess, {
    useCase: application.access.setRemoteAccess,
  });
  server.register(reviewMcp, {
    useCases: application,
    limits: options.limits.http,
  });
}
