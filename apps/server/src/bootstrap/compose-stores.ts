import { Effect } from 'effect';
import {
  DeviceStore,
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
import { InMemoryDeviceSightingStore } from '../adapters/access/in-memory-device-sighting-store.ts';
import { InMemoryPairingAttemptStore } from '../adapters/access/in-memory-pairing-attempt-store.ts';
import { InMemoryRouteStateStore } from '../adapters/access/in-memory-route-state-store.ts';

export type Stores = Effect.Success<ReturnType<typeof composeStores>>;

export const composeStores = Effect.fn('Server.composeStores')(function* () {
  return {
    inventory: yield* InventoryStore,
    worktreePresence: yield* WorktreePresenceStore,
    filePreferences: yield* FilePreferenceStore,
    environmentIdentity: yield* EnvironmentIdentityReader,
    environmentName: yield* EnvironmentNameStore,
    devices: yield* DeviceStore,
    deviceSightings: new InMemoryDeviceSightingStore(),
    pairingGrants: yield* PairingGrantStore,
    pairingAttempts: {
      sameOrigin: new InMemoryPairingAttemptStore(),
      crossOrigin: new InMemoryPairingAttemptStore(),
    },
    remoteAccess: yield* RemoteAccessStore,
    routeStates: new InMemoryRouteStateStore(),
    gitActions: yield* GitActionReceiptStore,
    reviews: yield* ReviewStore,
    reviewedFiles: yield* ReviewedFileStore,
    reviewedLayers: yield* ReviewedLayerStore,
    comments: yield* CommentStore,
    commentsSeen: yield* CommentSeenStore,
  };
});
