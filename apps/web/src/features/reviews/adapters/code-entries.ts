import type { FileDiffMetadata } from '@pierre/diffs';
import type { ReactNode } from 'react';
import { contentVersion } from '@/shared/lib/pierre';
import type { CommentTarget } from '../rules/comments';

type CodeReview = {
  path: string;
  control: ReactNode;
  reviewed?: boolean;
  stale?: boolean;
  fingerprint?: string | null;
};

export type CodeEntry =
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
    };

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
