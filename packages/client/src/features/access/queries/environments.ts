import { Effect, Option, Schedule, Stream } from 'effect';
import { Atom } from 'effect/reactivity';
import { ENVIRONMENT_PROTOCOL } from '@porcelain/contracts/shared';
import {
  REMOTE_STATUS_REFRESH_MS,
  REMOTE_STATUS_TIMEOUT_MS,
} from '../../../config/limits.ts';
import { requestEffect } from '../../../shared/api/effect-client.ts';
import { RequestError } from '../../../shared/api/request-error.ts';
import {
  remoteTransport,
  type Transport,
} from '../../../shared/api/transport.ts';
import type { AccessPlatformValue } from '../ports/access-platform.ts';
import {
  remoteStatus,
  type Remote,
  type RemoteAnswer,
} from '../rules/remotes.ts';
import { BootstrapClient } from '../../../shared/api/bootstrap-client.ts';

export function readRemoteEnvironment(
  transport: Transport,
  environmentId: string,
): Effect.Effect<RemoteAnswer> {
  return Effect.gen(function* () {
    const api = yield* BootstrapClient;
    const environment = yield* requestEffect(
      api.publicAccess.readEnvironment(),
    );
    if (
      environment.environmentId === environmentId &&
      environment.protocol === ENVIRONMENT_PROTOCOL
    )
      yield* requestEffect(api.session.readSession());
    return { kind: 'described' as const, environment };
  }).pipe(
    Effect.provide(BootstrapClient.layer(transport)),
    Effect.catch((error) =>
      Effect.succeed<RemoteAnswer>(
        error instanceof RequestError && error.status === 401
          ? { kind: 'unauthorized' }
          : { kind: 'unreachable' },
      ),
    ),
    Effect.timeoutOption(REMOTE_STATUS_TIMEOUT_MS),
    Effect.map((result) =>
      Option.getOrElse(result, (): RemoteAnswer => ({ kind: 'unreachable' })),
    ),
  );
}

const statusAtoms = Atom.family(
  ({ send, remote }: { send: AccessPlatformValue['send']; remote: Remote }) =>
    Atom.make(
      Stream.fromEffect(
        readRemoteEnvironment(
          remoteTransport(remote.address, remote.credential, send),
          remote.environmentId,
        ),
      ).pipe(
        Stream.repeat(Schedule.spaced(REMOTE_STATUS_REFRESH_MS)),
        Stream.takeUntil(
          (answer) => remoteStatus(remote, answer).kind === 'other-server',
        ),
      ),
    ).pipe(Atom.setIdleTTL(0)),
);

export function readRemoteStatus(
  platform: AccessPlatformValue,
  remote: Remote,
) {
  return statusAtoms({ send: platform.send, remote });
}
