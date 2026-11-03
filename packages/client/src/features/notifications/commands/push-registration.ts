import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import type { PushKind } from '@porcelain/contracts/access';
import { porcelainClient } from '../../../shared/api/client.ts';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';
import type { PushRegistrationPlan } from '../rules/notifications.ts';

export const syncPushRegistration = Atom.family(
  (connection: RuntimeConnection) =>
    clientRuntime(connection).fn(
      Effect.fn('PushRegistration.sync')(function* (
        plan: Exclude<PushRegistrationPlan, { kind: 'wait' }>,
      ) {
        const client = yield* porcelainClient(connection);
        if (plan.kind === 'clear') {
          yield* client.request((api) =>
            api.pushRegistration.clearPushRegistration(),
          );
          return [] as readonly PushKind[];
        }
        const answer = yield* client.request((api) =>
          api.pushRegistration.setPushRegistration({ payload: plan.request }),
        );
        return answer.kinds;
      }),
    ),
);
