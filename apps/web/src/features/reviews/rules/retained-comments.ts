import {
  commentIsStale,
  matchesCommentTarget,
  type CommentAnchor,
  type CommentTarget,
} from '@porcelain/client/reviews/rules';

export function retainedCommentTarget(
  revision: { headOid: string; base: string },
  filePath: string,
): CommentTarget {
  return {
    filePath,
    revision: revision.headOid,
    comparison: { kind: 'branch', base: revision.base },
  };
}

export function codeCommentMatches(
  anchor: CommentAnchor,
  target: CommentTarget,
  retained: boolean,
): boolean {
  return retained
    ? anchor.kind !== 'change' && anchor.filePath === target.filePath
    : matchesCommentTarget(anchor, target);
}

export function codeCommentStale(
  anchor: CommentAnchor,
  target: CommentTarget,
  retained?: {
    revision: number;
    commentRevision?: number | undefined;
    kind: 'file' | 'diff';
  },
): boolean {
  return (
    (retained !== undefined &&
      ((retained.kind === 'file' &&
        anchor.kind === 'codeRange' &&
        anchor.side === 'deletions') ||
        retained.commentRevision !== retained.revision ||
        anchor.revision !== target.revision ||
        anchor.comparison?.kind !== target.comparison?.kind ||
        (anchor.comparison?.kind === 'branch' &&
          target.comparison?.kind === 'branch' &&
          anchor.comparison.base !== target.comparison.base))) ||
    commentIsStale(anchor, target)
  );
}
