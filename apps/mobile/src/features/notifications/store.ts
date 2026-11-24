import { platformApiLevel } from 'expo-device';
import { AccessibilityInfo } from 'react-native';
import { Effect } from 'effect';
import { AsyncResult, Atom } from 'effect/reactivity';
import { router } from 'expo-router';
import { clearPushRegistration } from '@porcelain/client/notifications';
import type { RuntimeConnection } from '@porcelain/client/transport';
import { observeNotificationTaps } from '../../shared/adapters/push-notifications';
import { statusActivity } from '../../shared/adapters/status-activity';
import {
  preferencesState,
  remoteConnectionState,
} from '../../shared/application/store';

export const notificationsSync = Atom.make((get) => {
  const sent = new Set<RuntimeConnection>();
  const watched = new Set<RuntimeConnection>();
  const synchronize = () => {
    if (preferencesState.value.status !== 'ready') return;
    for (const { connection } of remoteConnectionState.value) {
      if (sent.has(connection)) continue;
      sent.add(connection);
      const command = clearPushRegistration(connection);
      get.mount(command);
      if (!watched.has(connection)) {
        watched.add(connection);
        get.subscribe(command, (result) => {
          if (AsyncResult.isFailure(result)) sent.delete(connection);
        });
      }
      get.set(command, undefined);
    }
  };
  get.addFinalizer(preferencesState.subscribe(synchronize));
  get.addFinalizer(remoteConnectionState.subscribe(synchronize));
  get.addFinalizer(
    statusActivity.subscribe(() => {
      if (statusActivity.isActive()) synchronize();
    }),
  );
  get.addFinalizer(
    observeNotificationTaps(() => router.push('/(tabs)/(worktrees)')),
  );
  synchronize();
});

const copyTitles = {
  brief: 'Copied brief',
  'worktree path': 'Copied worktree path',
};

export const notificationNotice = Atom.make<string | null>(null);

export const notify = Atom.fn(
  (event: { kind: 'copy'; target: keyof typeof copyTitles }, get) =>
    Effect.gen(function* () {
      if ((platformApiLevel ?? 0) >= 33) return;
      const title = copyTitles[event.target];
      get.set(notificationNotice, title);
      AccessibilityInfo.announceForAccessibility(title);
      yield* Effect.sleep('5 seconds');
      get.set(notificationNotice, null);
    }),
).pipe(Atom.keepAlive);
