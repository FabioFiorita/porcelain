import { Effect } from 'effect';
import type { Transport } from '../../../shared/api/transport.ts';
import { remoteTransport } from '../../../shared/api/transport.ts';
import { ConnectionError } from '../../../shared/api/connection-error.ts';
import { RequestError } from '../../../shared/api/request-error.ts';
import { requestEffect } from '../../../shared/api/effect-client.ts';
import type { AccessPlatform } from '../ports/access-platform.ts';
import type { PairingPlatform } from '../ports/pairing-platform.ts';
import type { AccessStore } from '../store.ts';
import { remoteLink, type PairingCode } from '../rules/pairing-link.ts';
import { remoteStatus } from '../rules/remotes.ts';
import { readRemoteEnvironment } from '../queries/environments.ts';
import { accessApi } from '../api.ts';
import { projectsApi } from '../../projects/api.ts';

type PairFailure =
  | Effect.Error<
      ReturnType<ReturnType<typeof accessApi>['pairing']['redeemPairing']>
    >
  | ConnectionError
  | RequestError;

function rejectedPairing(error: PairFailure) {
  if (error instanceof RequestError) return true;
  if (error instanceof ConnectionError) return false;
  return (
    error._tag === 'InvalidPairingError' ||
    error._tag === 'InvalidDeviceDetailsError'
  );
}

export function pairRemote(platform: AccessPlatform, value: string) {
  return Effect.gen(function* () {
    const link = remoteLink(value);
    if (!link)
      return yield* Effect.fail(
        new ConnectionError({
          message:
            'Paste the whole link porcelain pair printed, starting with http.',
        }),
      );
    const transport = remoteTransport(link.address, undefined, platform.send);
    const paired = yield* requestEffect(
      accessApi({ transport }).pairing.redeemPairing({
        payload: { code: link.code, platform: platform.name() },
      }),
    ).pipe(
      Effect.mapError((error) =>
        rejectedPairing(error)
          ? new ConnectionError({
              message:
                'That link was not accepted. It works once, for a few minutes; run porcelain pair again.',
            })
          : error instanceof ConnectionError
            ? new ConnectionError({
                message: `Could not reach ${link.address}. Check that Porcelain runs there and that this computer reaches it.`,
                cause: error.cause,
              })
            : error,
      ),
    );
    if (!paired.credential)
      return yield* Effect.fail(
        new ConnectionError({
          message: 'The remote paired but sent no credential.',
        }),
      );
    const answer = yield* readRemoteEnvironment(
      remoteTransport(link.address, paired.credential, platform.send),
      link.environmentId,
    );
    const status = remoteStatus(link, answer);
    if (status.kind !== 'online')
      return yield* Effect.fail(
        new ConnectionError({
          message:
            status.kind === 'other-server'
              ? 'Another Porcelain answered at that address than the one that made the link.'
              : status.kind === 'incompatible'
                ? 'That Porcelain runs a version this app cannot talk to. Update both to the same version.'
                : 'The remote paired but did not answer afterwards. Try again.',
        }),
      );
    return {
      environmentId: link.environmentId,
      address: link.address,
      name: status.name,
      credential: paired.credential,
      deviceId: paired.device.id,
    };
  });
}

export function pairEnvironment(
  store: AccessStore,
  platform: AccessPlatform,
  value: string,
) {
  return Effect.gen(function* () {
    if (store.getState().status !== 'ready')
      return yield* Effect.fail(
        new ConnectionError({
          message: 'Read saved environments before pairing.',
        }),
      );
    const remote = yield* pairRemote(platform, value);
    yield* store.getState().save(remote);
    return remote;
  });
}

export function redeemBrowserPairing(
  transport: Transport,
  platform: PairingPlatform,
  link: PairingCode,
) {
  return Effect.gen(function* () {
    const api = accessApi({ transport });
    const health = yield* requestEffect(api.publicAccess.readHealth()).pipe(
      Effect.mapError((error) =>
        !(error instanceof ConnectionError) &&
        !(error instanceof RequestError) &&
        error._tag !== 'MissingEnvironmentIdentityError'
          ? new ConnectionError({
              message:
                'That address answered, but it is not a Porcelain server.',
            })
          : new ConnectionError({
              message:
                'Could not reach Porcelain. Check that the server is running, then open the link again.',
              cause: error,
            }),
      ),
    );
    if (health.environmentId !== link.environmentId)
      return yield* Effect.fail(
        new ConnectionError({
          message: 'This link was made for a different Porcelain installation.',
        }),
      );
    const paired = yield* requestEffect(
      api.pairing.redeemPairing({
        payload: { code: link.code, platform: platform.name() },
      }),
    ).pipe(
      Effect.mapError((error) =>
        rejectedPairing(error)
          ? new ConnectionError({
              message: 'This pairing link is not usable. Ask for a new one.',
            })
          : error,
      ),
    );
    const inventory = yield* requestEffect(
      projectsApi({ transport }).readInventory(),
    ).pipe(
      Effect.mapError((error) =>
        error instanceof RequestError
          ? new ConnectionError({
              message:
                'Pairing succeeded but the workspace could not be loaded. Reload the page.',
            })
          : error,
      ),
    );
    return {
      inventory,
      principal: { kind: 'device' as const, deviceId: paired.device.id },
    };
  });
}
