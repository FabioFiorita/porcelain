/**
 * What a working path is, and enough of it to fingerprint, without following
 * it anywhere.
 *
 * A regular file is reduced to a digest of its bytes rather than its bytes:
 * the change list needs to know whether content moved, not what it says.
 *
 * The `stamp` answers a different question from the digest, and one the digest
 * cannot: *has this path been written since I last looked*. Content that was
 * changed and changed back has the same digest, so a reader could be handed
 * hunks Git captured of a state that no longer exists. The stamp is the
 * identity, size and change time of what was read, and a write moves the
 * change time — which the owner of a file cannot set backwards, unlike its
 * modification time. It is deliberately not part of a fingerprint: touching a
 * file must not make a mark stale.
 */
export type WorktreeEntry =
  | { kind: 'file'; digest: string; stamp: string }
  | { kind: 'symlink'; target: string; stamp: string }
  | { kind: 'other' };

/**
 * Classifies and digests working paths through the same no-follow boundary
 * every other file read uses, so a symlink is seen as a symlink rather than as
 * whatever it points at, and no ancestor of a path can be one either. A path
 * that cannot be read at all is absent from the answer, which is what makes it
 * unmarkable rather than silently marked.
 */
export type WorktreeFiles = (
  root: string,
  paths: readonly string[],
) => Promise<Map<string, WorktreeEntry>>;

/**
 * The stamp of one path the server names itself, such as a checkout's index.
 * Null when it is not there, which is itself a state that can change.
 */
export type StampPath = (path: string) => Promise<string | null>;
