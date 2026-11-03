import { Effect } from 'effect';
import type {
  PushRegistration,
  PushRegistrationKey,
} from '../../src/models/push-notifications.ts';
import type { PushRegistrationStore } from '../../src/ports/push-registration-store.ts';

export class InMemoryPushRegistrationStore implements PushRegistrationStore {
  private readonly registrations = new Map<string, PushRegistration>();

  list(): Effect.Effect<readonly PushRegistration[]> {
    return Effect.sync(() =>
      [...this.registrations.values()].map((entry) => structuredClone(entry)),
    );
  }

  save(registration: PushRegistration): Effect.Effect<void> {
    return Effect.sync(() => {
      this.registrations.set(
        registration.deviceId,
        structuredClone(registration),
      );
    });
  }

  remove(key: PushRegistrationKey): Effect.Effect<void> {
    return Effect.sync(() => {
      this.registrations.delete(key.deviceId);
    });
  }
}
