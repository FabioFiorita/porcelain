import type {
  CommentsResponse,
  PublishReviewRequest,
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

export function commentSpread(comments: readonly DraftComment[]): string {
  const files = new Set(
    comments.flatMap((comment) => {
      const path = anchorPath(comment.anchor);
      return path === undefined ? [] : [path];
    }),
  ).size;
  const elsewhere = comments.filter(
    (comment) => anchorPath(comment.anchor) === undefined,
  ).length;
  return [
    files > 0 ? `on ${files} ${files === 1 ? 'file' : 'files'}` : '',
    elsewhere > 0 ? `${elsewhere} on the Walkthrough` : '',
  ]
    .filter(Boolean)
    .join(', ');
}

export function draftCountLabel(count: number): string {
  return count === 1 ? '1 draft comment' : `${count} draft comments`;
}

export function postedComments(
  view: CommentsResponse | undefined,
): readonly DraftComment[] {
  return (view?.comments ?? []).filter(
    (comment) => comment.publication.status === 'published',
  );
}

type ReviewPreview = Extract<ReviewPreviewResponse, { kind: 'available' }>;

export function inlineReviewLocation(
  comment: ReviewPreview['inline'][number],
): string {
  const start = comment.startLine === undefined ? '' : `${comment.startLine}-`;
  const removed = comment.side === 'LEFT' ? ' (removed)' : '';
  return `${comment.path}:${start}${comment.line}${removed}`;
}

const BODY_REASON: Record<
  ReviewPreview['general'][number]['reason'],
  string | undefined
> = {
  'not-in-pull-request': 'not in the pull request diff',
  outdated: 'outdated',
  file: 'whole file',
  step: undefined,
  node: undefined,
};

export function generalReviewNote(
  reason: ReviewPreview['general'][number]['reason'],
): string | undefined {
  return BODY_REASON[reason];
}

function reviewBodies(
  preview: ReviewPreview,
): Readonly<Record<string, string>> {
  return Object.fromEntries(
    [...preview.inline, ...preview.general].map((comment) => [
      comment.id,
      comment.body,
    ]),
  );
}

function publishableBodies(
  bodies: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> | undefined {
  const trimmed = Object.entries(bodies).map(
    ([id, text]) => [id, text.trim()] as const,
  );
  return trimmed.some(([, text]) => text.length === 0)
    ? undefined
    : Object.fromEntries(trimmed);
}

export type ReviewForm = {
  readonly summary: string;
  readonly bodies: Readonly<Record<string, string>>;
};

export function reviewForm(preview: ReviewPreview): ReviewForm {
  return { summary: '', bodies: reviewBodies(preview) };
}

export function withReviewBody(
  form: ReviewForm,
  id: string,
  text: string,
): ReviewForm {
  return { ...form, bodies: { ...form.bodies, [id]: text } };
}

export function reviewRequest(
  form: ReviewForm,
  preview: ReviewPreview,
): PublishReviewRequest | undefined {
  const bodies = publishableBodies(form.bodies);
  if (bodies === undefined) return undefined;
  const { owner, repo, number } = preview.pullRequest;
  return {
    pullRequest: { owner, repo, number },
    headOid: preview.headOid,
    draftRevision: preview.draftRevision,
    inlineIds: preview.inline.map(({ id }) => id),
    summary: form.summary,
    bodies,
  };
}

const MAX_FAILURE_LENGTH = 300;

export function commentFailureText(error: unknown, fallback: string): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.length > 0 &&
    error.message.length < MAX_FAILURE_LENGTH
  )
    return error.message;
  return fallback;
}

export function quotedAnswer(question: string, answer: string): string {
  return `> ${question.replaceAll('\n', '\n> ')}\n\n${answer}`;
}

export function nodeCommentCounts(
  view: CommentsResponse | undefined,
  title: string,
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const comment of openComments(view))
    if (comment.anchor.kind === 'node' && comment.anchor.title === title)
      counts.set(
        comment.anchor.node,
        (counts.get(comment.anchor.node) ?? 0) + 1,
      );
  return counts;
}
