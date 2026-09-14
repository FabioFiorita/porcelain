import type { CommentAnchor } from './comments';
/**
 * A document is the stable thing shown in a centre pane. Surface navigation
 * only chooses which documents are available; it never owns the document.
 */
export type DocumentRef =
  | { kind: 'handoff' }
  | { kind: 'layer'; layerId: string }
  | { kind: 'change'; path: string }
  | { kind: 'file'; path: string }
  | { kind: 'commit'; oid: string }
  | { kind: 'artifact'; artifactId: string };

export const HANDOFF: DocumentRef = { kind: 'handoff' };

export function entryKey(ref: DocumentRef): string {
  switch (ref.kind) {
    case 'handoff':
      return 'handoff';
    case 'layer':
      return `layer:${ref.layerId}`;
    case 'change':
      return `change:${ref.path}`;
    case 'file':
      return `file:${ref.path}`;
    case 'commit':
      return `commit:${ref.oid}`;
    case 'artifact':
      return `artifact:${ref.artifactId}`;
  }
}

/** Unknown entries are discarded, including obsolete git action tabs. */
export function parseEntry(entry: string | undefined): DocumentRef | null {
  if (entry == null || entry === '') return null;
  if (entry === 'handoff') return HANDOFF;

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
    case 'artifact':
      // Artifact tabs used to persist display names. Reject those stale keys
      // rather than sending a name to an ID-addressed endpoint.
      return UUID.test(value) ? { kind, artifactId: value } : null;
    default:
      return null;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

export type OpenDocument = (ref: DocumentRef, anchor?: CommentAnchor) => void;
