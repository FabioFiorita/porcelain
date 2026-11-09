import {
  rangeAnchor,
  type CommentTarget,
  type CommentAnchor,
  type FileCommentAnchor,
} from '@porcelain/client/reviews/rules';

type NativeRange = {
  startLine: number;
  endLine: number;
  side?: 'additions' | 'deletions' | undefined;
};

export function savedFileCommentTarget(
  filePath: string,
  contentFingerprint: string | undefined,
): CommentTarget | undefined {
  return contentFingerprint
    ? { filePath, comparison: { kind: 'file' }, contentFingerprint }
    : undefined;
}

export function commitCommentTarget(
  filePath: string,
  revision: string,
  parent: number,
): CommentTarget {
  return { filePath, revision, comparison: { kind: 'commit', parent } };
}

export function documentCommentAnchor(
  target: CommentTarget | undefined,
  selection: NativeRange | undefined,
): FileCommentAnchor | undefined {
  if (!target) return undefined;
  if (!selection) return { ...target, kind: 'file' };
  return (
    rangeAnchor(target, {
      start: selection.startLine,
      end: selection.endLine,
      ...(selection.side ? { side: selection.side } : {}),
    }) ?? undefined
  );
}

export function documentCommentContext(anchor: CommentAnchor): string {
  const comparison = anchor.comparison;
  if (!comparison) return '';
  switch (comparison.kind) {
    case 'file':
      return 'Saved file';
    case 'worktree':
      return `${comparison.scope} diff`;
    case 'branch':
      return `Branch against ${comparison.base} · ${anchor.revision?.slice(0, 8) ?? 'Unknown revision'}`;
    case 'commit':
      return `Commit ${anchor.revision?.slice(0, 8) ?? 'Unknown revision'} · Parent ${comparison.parent}`;
  }
}
