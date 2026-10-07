import { Context, Effect, Layer } from 'effect';
import {
  DeviceStore,
  DeviceSightingStore,
  PairingAttemptStore,
  RouteStateStore,
  EnvironmentIdentityReader,
  EnvironmentNameStore,
  PairingGrantStore,
  RemoteAccessStore,
} from '@porcelain/access/ports';
import { GitActionReceiptStore } from '@porcelain/git-actions/ports';
import {
  FilePreferenceStore,
  InventoryStore,
  WorktreePresenceStore,
} from '@porcelain/projects/ports';
import {
  CommentSeenStore,
  CommentStore,
  ReviewedFileStore,
  ReviewedLayerStore,
  ReviewStore,
} from '@porcelain/reviews/ports';
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
    inventory: yield* InventoryStore,
    worktreePresence: yield* WorktreePresenceStore,
    filePreferences: yield* FilePreferenceStore,
    environmentIdentity: yield* EnvironmentIdentityReader,
    environmentName: yield* EnvironmentNameStore,
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
    reviews: yield* ReviewStore,
    reviewedFiles: yield* ReviewedFileStore,
    reviewedLayers: yield* ReviewedLayerStore,
    comments: yield* CommentStore,
    commentsSeen: yield* CommentSeenStore,
  };
});
