import type { FileContents, FileDiffMetadata } from '@pierre/diffs';
import type { ReactNode } from 'react';
import { contentVersion } from '@/shared/lib/pierre';
import type { CommentTarget } from '@porcelain/client/reviews/rules';
import type { AgentCodeNote } from '../rules/code-notes';

type CodeReview = {
  path: string;
  control: ReactNode;
  reviewed?: boolean;
  stale?: boolean;
  fingerprint?: string | null;
};

export type CodeEntry = { agentNotes?: readonly AgentCodeNote[] } & (
  | {
      id: string;
      kind: 'diff';
      path: string;
      fileDiff: FileDiffMetadata;
      version: number;
      note?: string;
      comment?: CommentTarget;
      review?: CodeReview;
    }
  | {
      id: string;
      kind: 'file';
      path: string;
      contents: string;
      version: number;
      note?: string;
      comment?: CommentTarget;
      review?: CodeReview;
    }
);

export function fileEntry(
  id: string,
  path: string,
  contents: string,
  note?: string,
): CodeEntry {
  return {
    id,
    kind: 'file',
    path,
    contents,
    version: contentVersion(contents),
    ...(note ? { note } : {}),
  };
}

const shownDiffs = new Map<string, FileDiffMetadata>();
const shownFiles = new Map<string, FileContents>();

export function codeTarget(
  entry: CodeEntry,
):
  | { type: 'diff'; fileDiff: FileDiffMetadata }
  | { type: 'file'; file: FileContents } {
  if (entry.kind === 'diff') {
    const shown = shownDiffs.get(entry.id);
    if (
      shown?.cacheKey !== undefined &&
      shown.cacheKey === entry.fileDiff.cacheKey
    )
      return { type: 'diff', fileDiff: shown };
    shownDiffs.set(entry.id, entry.fileDiff);
    return { type: 'diff', fileDiff: entry.fileDiff };
  }
  const shown = shownFiles.get(entry.id);
  if (shown?.name === entry.path && shown.contents === entry.contents)
    return { type: 'file', file: shown };
  const file = { name: entry.path, contents: entry.contents };
  shownFiles.set(entry.id, file);
  return { type: 'file', file };
}
