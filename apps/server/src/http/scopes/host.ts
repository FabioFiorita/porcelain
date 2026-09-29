import type { Limits } from '../../config/limits.ts';
import type { FastifyInstance } from 'fastify';
import type { IssuePairingUseCase } from '../../use-cases/access/issue-pairing.ts';
import type { ListAccessUseCase } from '../../use-cases/access/list-access.ts';
import type { ReadRemoteAccessUseCase } from '../../use-cases/access/read-remote-access.ts';
import type { RevokeAccessUseCase } from '../../use-cases/access/revoke-access.ts';
import type { SetRemoteAccessUseCase } from '../../use-cases/access/set-remote-access.ts';
import {
  authenticate,
  type AuthenticateOptions,
} from '../hooks/authenticate.ts';
import {
  requireLocalDevice,
  type LocalDeviceOptions,
} from '../hooks/local-device.ts';
import { issuePairing } from '../routes/access/issue-pairing.ts';
import { listAccess } from '../routes/access/list-access.ts';
import { readRemoteAccess } from '../routes/access/read-remote-access.ts';
import { revokeAccess } from '../routes/access/revoke-access.ts';
import { setRemoteAccess } from '../routes/access/set-remote-access.ts';

export type HostUseCases = {
  access: LocalDeviceOptions['access'] & {
    issuePairing: Pick<IssuePairingUseCase, 'execute'>;
    listAccess: Pick<ListAccessUseCase, 'execute'>;
    readRemoteAccess: Pick<ReadRemoteAccessUseCase, 'execute'>;
    revokeAccess: Pick<RevokeAccessUseCase, 'execute'>;
    setRemoteAccess: Pick<SetRemoteAccessUseCase, 'execute'>;
  };
};

export async function hostScope(
  server: FastifyInstance,
  options: {
    application: HostUseCases & AuthenticateOptions;
    limits: Limits;
  },
) {
  const { application } = options;
  server.addHook(
    'onRequest',
    authenticate(application, {
      cookieMaxAgeSeconds: options.limits.access.device.cookieMaxAgeSeconds,
    }),
  );
  server.addHook('onRequest', requireLocalDevice(application));
  server.register(listAccess, { useCase: application.access.listAccess });
  server.register(issuePairing, { useCase: application.access.issuePairing });
  server.register(revokeAccess, { useCase: application.access.revokeAccess });
  server.register(readRemoteAccess, {
    useCase: application.access.readRemoteAccess,
  });
  server.register(setRemoteAccess, {
    useCase: application.access.setRemoteAccess,
  });
}
