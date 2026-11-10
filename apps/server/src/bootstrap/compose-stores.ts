import {
  WalkthroughStore,
  WalkthroughInventoryReader,
} from '@porcelain/walkthroughs/ports';
import { GitHubAccountStore } from '@porcelain/reviews/ports';
import { Context, Effect, Layer } from 'effect';
import {
  DeviceStore,
  DeviceSightingStore,
  PairingAttemptStore,
  RouteStateStore,
  EnvironmentIdentityReader,
  EnvironmentLabelStore,
  ReviewGitSettingsStore,
  PushRegistrationStore,
  PairingGrantStore,
  RemoteAccessStore,
} from '@porcelain/access/ports';
import { GitActionReceiptStore } from '@porcelain/git-actions/ports';
import {
  FilePreferenceStore,
  InventoryStore,
  WorktreePresenceStore,
} from '@porcelain/projects/ports';
import { ReviewedFileStore } from '@porcelain/reviews/ports';
import { inMemoryDeviceSightingStoreLayer } from '../adapters/access/in-memory-device-sighting-store.ts';
import { inMemoryPairingAttemptStoreLayer } from '../adapters/access/in-memory-pairing-attempt-store.ts';
import { inMemoryRouteStateStoreLayer } from '../adapters/access/in-memory-route-state-store.ts';

export type Stores = Effect.Success<ReturnType<typeof composeStores>>;

export const composeStores = Effect.fn('Server.composeStores')(function* () {
  const memory = yield* Layer.build(
    Layer.mergeAll(
      inMemoryDeviceSightingStoreLayer,
      inMemoryRouteStateStoreLayer,
    ),
  );
  const sameOrigin = yield* Layer.build(inMemoryPairingAttemptStoreLayer);
  const crossOrigin = yield* Layer.build(inMemoryPairingAttemptStoreLayer);
  return {
    walkthroughs: yield* WalkthroughStore,
    walkthroughInventory: yield* WalkthroughInventoryReader,
    inventory: yield* InventoryStore,
    worktreePresence: yield* WorktreePresenceStore,
    filePreferences: yield* FilePreferenceStore,
    environmentIdentity: yield* EnvironmentIdentityReader,
    environmentLabel: yield* EnvironmentLabelStore,
    reviewGitSettings: yield* ReviewGitSettingsStore,
    pushRegistrations: yield* PushRegistrationStore,
    devices: yield* DeviceStore,
    deviceSightings: Context.get(memory, DeviceSightingStore),
    pairingGrants: yield* PairingGrantStore,
    pairingAttempts: {
      sameOrigin: Context.get(sameOrigin, PairingAttemptStore),
      crossOrigin: Context.get(crossOrigin, PairingAttemptStore),
    },
    remoteAccess: yield* RemoteAccessStore,
    routeStates: Context.get(memory, RouteStateStore),
    gitActions: yield* GitActionReceiptStore,
    githubAccounts: yield* GitHubAccountStore,
    reviewedFiles: yield* ReviewedFileStore,
  };
});
