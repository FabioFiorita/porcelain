import type { StorageSession } from '@porcelain/storage';
import {
  createDeviceStore,
  createEnvironmentIdentityStore,
  createPairingGrantStore,
} from '@porcelain/storage/access';
import { createGitActionStore } from '@porcelain/storage/git-actions';
import {
  createFilePreferenceStore,
  createInventoryStore,
  createProjectRemovalStore,
  createWorktreePresenceStore,
} from '@porcelain/storage/projects';
import {
  createCommentSeenStore,
  createCommentStore,
  createReviewedFileStore,
  createReviewedLayerStore,
  createReviewStore,
} from '@porcelain/storage/reviews';
import { CachedDeviceStore } from '../adapters/access/cached-device-store.ts';
import { InMemoryDeviceSightingStore } from '../adapters/access/in-memory-device-sighting-store.ts';
import { InMemoryPairingAttemptStore } from '../adapters/access/in-memory-pairing-attempt-store.ts';

export type Stores = ReturnType<typeof composeStores>;

export function composeStores(session: StorageSession) {
  return {
    inventory: createInventoryStore(session),
    worktreePresence: createWorktreePresenceStore(session),
    filePreferences: createFilePreferenceStore(session),
    projectRemoval: createProjectRemovalStore(session),
    environmentIdentity: createEnvironmentIdentityStore(session),
    devices: new CachedDeviceStore(createDeviceStore(session)),
    deviceSightings: new InMemoryDeviceSightingStore(),
    pairingGrants: createPairingGrantStore(session),
    pairingAttempts: new InMemoryPairingAttemptStore(),
    gitActions: createGitActionStore(session),
    reviews: createReviewStore(session),
    reviewedFiles: createReviewedFileStore(session),
    reviewedLayers: createReviewedLayerStore(session),
    comments: createCommentStore(session),
    commentsSeen: createCommentSeenStore(session),
  };
}
