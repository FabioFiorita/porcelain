import { HISTORY_OID_LENGTH } from '@/config/limits';
import type { CommentAnchor, RevealComment } from './comments';
export type DocumentRef =
  | { kind: 'handoff' }
  | { kind: 'layer'; layerId: string }
  | { kind: 'unexplained' }
  | { kind: 'proof' }
  | { kind: 'change'; path: string }
  | { kind: 'file'; path: string }
  | { kind: 'commit'; oid: string }
  | { kind: 'branch' }
  | { kind: 'branch-file'; path: string };

const HANDOFF: DocumentRef = { kind: 'handoff' };
export const BRANCH: DocumentRef = { kind: 'branch' };
export const UNEXPLAINED: DocumentRef = { kind: 'unexplained' };
export const PROOF: DocumentRef = { kind: 'proof' };

export function entryKey(ref: DocumentRef): string {
  switch (ref.kind) {
    case 'handoff':
      return 'handoff';
    case 'unexplained':
      return 'unexplained';
    case 'proof':
      return 'proof';
    case 'layer':
      return `layer:${ref.layerId}`;
    case 'change':
      return `change:${ref.path}`;
    case 'file':
      return `file:${ref.path}`;
    case 'commit':
      return `commit:${ref.oid}`;
    case 'branch':
      return 'branch';
    case 'branch-file':
      return `branch:${ref.path}`;
  }
}

export function parseEntry(entry: string | undefined): DocumentRef | null {
  if (entry == null || entry === '') return null;
  if (entry === 'handoff') return HANDOFF;
  if (entry === 'unexplained') return UNEXPLAINED;
  if (entry === 'proof') return PROOF;
  if (entry === 'branch') return BRANCH;

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
    case 'branch':
      return { kind: 'branch-file', path: value };
    case 'commit':
      return /^[0-9a-f]{4,64}$/.test(value) ? { kind, oid: value } : null;
    default:
      return null;
  }
}

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

export type DocumentInteraction = {
  active: boolean;
  worktreeId: string;
  entry: string;
  reveal?: RevealComment | undefined;
};

type Surface = 'changes' | 'files' | 'history';

const surfaceTitles: Record<Surface, string> = {
  changes: 'Changes',
  files: 'Files',
  history: 'History',
};

function documentTitle(ref: DocumentRef): string {
  switch (ref.kind) {
    case 'handoff':
      return 'Changes';
    case 'unexplained':
      return 'Not explained';
    case 'proof':
      return 'Proof';
    case 'layer':
      return 'Review';
    case 'branch':
      return 'Branch changes';
    case 'commit':
      return ref.oid.slice(0, HISTORY_OID_LENGTH);
    case 'change':
    case 'file':
    case 'branch-file':
      return ref.path.split('/').at(-1) ?? ref.path;
  }
}

export function workspaceTitle(input: {
  entry: string | undefined;
  surface: Surface | undefined;
  project: string | undefined;
}): string {
  const ref = parseEntry(input.entry);
  const shown = ref
    ? documentTitle(ref)
    : surfaceTitles[input.surface ?? 'changes'];
  return input.project ? `${shown} — ${input.project}` : shown;
}
