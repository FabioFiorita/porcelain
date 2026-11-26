import type {
  CommentsResponse,
  ReviewPreviewResponse,
} from '@porcelain/contracts/comments';

export type DraftComment = CommentsResponse['comments'][number];
export type CommentAnchor = DraftComment['anchor'];

export function openComments(
  view: CommentsResponse | undefined,
): readonly DraftComment[] {
  return (view?.comments ?? []).filter(
    (comment) => comment.publication.status === 'draft',
  );
}

export function anchorPath(anchor: CommentAnchor): string | undefined {
  return anchor.kind === 'lines' || anchor.kind === 'file'
    ? anchor.path
    : undefined;
}

export function commentCountsByPath(
  view: CommentsResponse | undefined,
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const comment of openComments(view)) {
    const path = anchorPath(comment.anchor);
    if (path !== undefined) counts.set(path, (counts.get(path) ?? 0) + 1);
  }
  return counts;
}

export function commentsAt(
  view: CommentsResponse | undefined,
  match: (anchor: CommentAnchor) => boolean,
): readonly DraftComment[] {
  return openComments(view).filter((comment) => match(comment.anchor));
}

function lineRangeLabel(start: number, end: number): string {
  return start === end ? `Line ${start}` : `Lines ${start}–${end}`;
}

export function anchorLabel(anchor: CommentAnchor): string {
  switch (anchor.kind) {
    case 'lines':
      return `${anchor.path} · ${anchor.side === 'deletions' ? 'removed ' : ''}${lineRangeLabel(anchor.start, anchor.end).toLowerCase()}`;
    case 'file':
      return anchor.path;
    case 'step':
      return `Step · ${anchor.title}`;
    case 'node':
      return `${anchor.node} · ${anchor.title}`;
  }
}

export function reviewUnavailableText(
  reason: Extract<ReviewPreviewResponse, { kind: 'unavailable' }>['reason'],
): string {
  switch (reason) {
    case 'no-pull-request':
      return 'This branch has no open pull request. Push it and open one, or copy the comments for an agent.';
    case 'no-comments':
      return 'There are no open comments to post.';
    case 'not-github':
      return 'This project is not on GitHub.';
    case 'gh-not-installed':
      return 'Install the GitHub CLI (gh) on the connected computer to post reviews.';
    case 'no-accounts':
    case 'no-access':
      return 'Sign in to GitHub with gh on the connected computer to post reviews.';
    case 'rate-limited':
      return 'GitHub is rate limiting requests. Try again in a few minutes.';
    case 'pull-request-not-found':
      return 'The pull request could not be found.';
    case 'offline':
    case 'invalid-response':
      return 'GitHub could not be reached. Try again.';
  }
}
