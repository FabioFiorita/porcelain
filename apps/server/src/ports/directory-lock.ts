import type { Effect } from 'effect';
export type DirectoryLock = { readonly release: Effect.Effect<void> };
