import { Layer } from 'effect';
import { databaseLayer } from './connection.ts';
import { sqliteDeviceStoreLayer } from '../repositories/access/sqlite-device-store.ts';
import { sqliteEnvironmentIdentityReaderLayer } from '../repositories/access/sqlite-environment-identity-reader.ts';
import { sqliteEnvironmentNameStoreLayer } from '../repositories/access/sqlite-environment-name-store.ts';
import { sqlitePairingGrantStoreLayer } from '../repositories/access/sqlite-pairing-grant-store.ts';
import { sqliteRemoteAccessStoreLayer } from '../repositories/access/sqlite-remote-access-store.ts';
import { sqliteFilePreferenceStoreLayer } from '../repositories/projects/sqlite-file-preference-store.ts';
import { sqliteInventoryStoreLayer } from '../repositories/projects/sqlite-inventory-store.ts';
import { sqliteWorktreePresenceStoreLayer } from '../repositories/projects/sqlite-worktree-presence-store.ts';
import { sqliteCommentSeenStoreLayer } from '../repositories/reviews/sqlite-comment-seen-store.ts';
import { sqliteCommentStoreLayer } from '../repositories/reviews/sqlite-comment-store.ts';
import { sqliteReviewStoreLayer } from '../repositories/reviews/sqlite-review-store.ts';
import { sqliteReviewedFileStoreLayer } from '../repositories/reviews/sqlite-reviewed-file-store.ts';
import { sqliteReviewedLayerStoreLayer } from '../repositories/reviews/sqlite-reviewed-layer-store.ts';
import { sqliteGitActionReceiptStoreLayer } from '../repositories/git-actions/sqlite-git-action-receipt-store.ts';

export function storageLayer(
  dataDirectory: string,
  options: { worktreeIdLength: number; busyTimeoutMs: number },
) {
  return Layer.mergeAll(
    sqliteDeviceStoreLayer,
    sqliteEnvironmentIdentityReaderLayer,
    sqliteEnvironmentNameStoreLayer,
    sqlitePairingGrantStoreLayer,
    sqliteRemoteAccessStoreLayer,
    sqliteFilePreferenceStoreLayer,
    sqliteInventoryStoreLayer,
    sqliteWorktreePresenceStoreLayer,
    sqliteCommentSeenStoreLayer,
    sqliteCommentStoreLayer,
    sqliteReviewStoreLayer,
    sqliteReviewedFileStoreLayer,
    sqliteReviewedLayerStoreLayer,
    sqliteGitActionReceiptStoreLayer,
  ).pipe(Layer.provideMerge(databaseLayer(dataDirectory, options)));
}
