/**
 * Everything that can open as a tab in the centre. The active one is the
 * `entry` search param; its string form comes from `entryKey`.
 */
export type DocumentRef =
  /** The overview: the agent's summary and graph when there is a review, else plain Changes. */
  | { kind: 'review' }
  | { kind: 'layer'; layerId: string }
  /** Changed lines no step of the review explains. */
  | { kind: 'unexplained' }
  | { kind: 'change'; path: string }
  | { kind: 'file'; path: string }
  | { kind: 'commit'; oid: string };

export const REVIEW: DocumentRef = { kind: 'review' };
export const UNEXPLAINED: DocumentRef = { kind: 'unexplained' };

export function entryKey(ref: DocumentRef): string {
  switch (ref.kind) {
    case 'review':
      return 'review';
    case 'unexplained':
      return 'unexplained';
    case 'layer':
      return `layer:${ref.layerId}`;
    case 'change':
      return `change:${ref.path}`;
    case 'file':
      return `file:${ref.path}`;
    case 'commit':
      return `commit:${ref.oid}`;
  }
}

/**
 * Unknown or malformed entries parse to null and are dropped from the URL and
 * from stored tabs (e.g. `artifact:handoff.html` from when uploads opened as tabs).
 * `handoff` is the old name of the overview.
 */
export function parseEntry(entry: string | undefined): DocumentRef | null {
  if (entry == null || entry === '') return null;
  if (entry === 'review' || entry === 'handoff') return REVIEW;
  if (entry === 'unexplained') return UNEXPLAINED;
  const separator = entry.indexOf(':');
  if (separator <= 0) return null;
  const kind = entry.slice(0, separator);
  const value = entry.slice(separator + 1);
  if (value === '') return null;
  switch (kind) {
    case 'layer':
      return { kind, layerId: value };
    case 'change':
    case 'file':
      return { kind, path: value };
    case 'commit':
      return /^[0-9a-f]{4,64}$/.test(value) ? { kind, oid: value } : null;
    default:
      return null;
  }
}

/** Add a tab after the active one; re-opening an open tab changes nothing. */
export function withDocument(
  open: readonly string[],
  key: string,
  after?: string | null,
): string[] {
  if (open.includes(key)) return [...open];
  const index = after == null ? -1 : open.indexOf(after);
  const next = [...open];
  next.splice(index === -1 ? next.length : index + 1, 0, key);
  return next;
}

export function withoutDocument(
  open: readonly string[],
  key: string,
): string[] {
  return open.filter((entry) => entry !== key);
}

/** Closing the active tab focuses its right neighbour, else its left. */
export function focusAfterClose(
  open: readonly string[],
  key: string,
): string | null {
  const index = open.indexOf(key);
  if (index === -1) return null;
  return open[index + 1] ?? open[index - 1] ?? null;
}
