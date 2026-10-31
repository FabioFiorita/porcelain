import { afterEach } from 'vitest';
import type { ManagedRuntime } from 'effect';
import type { AtomRegistry } from 'effect/reactivity';
import type { FileDrafts } from '../../src/features/files/store.ts';
import type { RuntimeConnection } from '../../src/shared/api/connection.ts';

type FileDraftLifetime = {
  connection: RuntimeConnection;
  registry: AtomRegistry.AtomRegistry;
  application: ManagedRuntime.ManagedRuntime<FileDrafts, never>;
};
const owned = new Set<FileDraftLifetime>();
export function ownFileDraftLifetime(lifetime: FileDraftLifetime) {
  owned.add(lifetime);
}
afterEach(async () => {
  for (const { connection, registry, application } of owned) {
    registry.dispose();
    await connection.close();
    await application.dispose();
  }
  owned.clear();
});
