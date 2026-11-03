import { Effect } from 'effect';
import { AsyncResult, Atom } from 'effect/reactivity';
import { router } from 'expo-router';
import { syncPushRegistration } from '@porcelain/client/notifications';
import { notificationReviewRoute } from '@porcelain/client/reviews/rules';
import {
  notificationKinds,
  pushRegistrationPlan,
  type PushTokenState,
} from '@porcelain/client/notifications/rules';
import type { RuntimeConnection } from '@porcelain/client/transport';
import {
  observeNotificationTaps,
  readPushToken,
} from '../../shared/adapters/push-notifications';
import { statusActivity } from '../../shared/adapters/status-activity';
import {
  preferencesState,
  remoteConnectionState,
} from '../../shared/application/store';

export const pushTokenState = Atom.make<PushTokenState>({
  kind: 'unknown',
}).pipe(Atom.keepAlive);

export const refreshPushToken = Atom.fn((ask: boolean, get) =>
  Effect.gen(function* () {
    const next = yield* Effect.promise(() => readPushToken(ask));
    get.set(pushTokenState, next);
    return next;
  }),
);

const CLEAR_KEY = JSON.stringify({ kind: 'clear' });

export const notificationsSync = Atom.make((get) => {
  const sent = new Map<RuntimeConnection, string>();
  const watched = new Set<RuntimeConnection>();
  get.mount(refreshPushToken);
  const wanted = () =>
    preferencesState.value.status === 'ready' &&
    notificationKinds(preferencesState.value.preferences.notifications).length >
      0;
  const fetchToken = () => {
    if (wanted() && get.once(pushTokenState).kind !== 'ready')
      get.set(refreshPushToken, false);
  };
  const synchronize = () => {
    const { preferences, status } = preferencesState.value;
    if (status !== 'ready') return;
    const plan = pushRegistrationPlan(
      preferences.notifications,
      get.once(pushTokenState),
    );
    if (plan.kind === 'wait') return;
    const key = JSON.stringify(plan);
    for (const { connection } of remoteConnectionState.value) {
      if (sent.get(connection) === key) continue;
      sent.set(connection, key);
      const command = syncPushRegistration(connection);
      get.mount(command);
      if (!watched.has(connection)) {
        watched.add(connection);
        get.subscribe(command, (result) => {
          if (AsyncResult.isFailure(result)) sent.delete(connection);
        });
      }
      get.set(command, plan);
    }
  };
  get.addFinalizer(
    preferencesState.subscribe(() => {
      fetchToken();
      synchronize();
    }),
  );
  get.addFinalizer(remoteConnectionState.subscribe(synchronize));
  get.subscribe(pushTokenState, synchronize);
  get.addFinalizer(
    statusActivity.subscribe(() => {
      if (!statusActivity.isActive()) return;
      for (const [connection, key] of sent)
        if (key !== CLEAR_KEY) sent.delete(connection);
      fetchToken();
      synchronize();
    }),
  );
  get.addFinalizer(
    observeNotificationTaps((data) =>
      router.push(notificationReviewRoute(data)),
    ),
  );
  fetchToken();
  synchronize();
});
