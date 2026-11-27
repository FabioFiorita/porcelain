import type {
  CommentSide,
  DraftComment,
  DraftCommentAnchor,
  DraftCommentView,
  GeneralReviewComment,
  InlineReviewComment,
  PullRequestDiff,
  ReviewPlan,
} from '../models/draft-comment.ts';

export type PatchLines = Record<CommentSide, ReadonlyMap<number, string>>;

const HUNK = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

function splitLines(text: string): string[] {
  return text.split(/\r?\n/);
}

export function patchLines(patch: string): PatchLines {
  const additions = new Map<number, string>();
  const deletions = new Map<number, string>();
  let inHunk = false;
  let left = 0;
  let right = 0;
  for (const line of splitLines(patch)) {
    const header = HUNK.exec(line);
    if (header) {
      inHunk = true;
      left = Number(header[1]);
      right = Number(header[2]);
      continue;
    }
    if (!inHunk || line.startsWith('\\')) continue;
    const marker = line[0];
    const text = line.slice(1);
    if (marker === '+') {
      additions.set(right, text);
      right += 1;
    } else if (marker === '-') {
      deletions.set(left, text);
      left += 1;
    } else if (marker === ' ' || line === '') {
      additions.set(right, text);
      deletions.set(left, text);
      right += 1;
      left += 1;
    }
  }
  return { additions, deletions };
}

function anchoredText(
  text: string,
  start: number,
  end: number,
): string | undefined {
  const lines = splitLines(text);
  if (start < 1 || end < start || end > lines.length) return undefined;
  return lines.slice(start - 1, end).join('\n');
}

export function draftOutdated(
  anchor: DraftCommentAnchor,
  currentText: string | undefined,
): boolean {
  if (anchor.kind !== 'lines' || anchor.side === 'deletions') return false;
  if (currentText === undefined) return true;
  return anchoredText(currentText, anchor.start, anchor.end) !== anchor.text;
}

export function outdatedCheckPaths(
  drafts: readonly DraftComment[],
): readonly string[] {
  return [
    ...new Set(
      drafts.flatMap((draft) =>
        draft.anchor.kind === 'lines' &&
        draft.anchor.side === 'additions' &&
        draft.publication.status === 'draft'
          ? [draft.anchor.path]
          : [],
      ),
    ),
  ];
}

function lineRange(start: number, end: number) {
  return start === end ? `${start}` : `${start}-${end}`;
}

function commentLocation(anchor: DraftCommentAnchor): string {
  switch (anchor.kind) {
    case 'lines':
      return `${anchor.path}:${lineRange(anchor.start, anchor.end)}${anchor.side === 'deletions' ? ' (removed lines)' : ''}`;
    case 'file':
      return anchor.path;
    case 'step':
      return `Walkthrough step “${anchor.title}”`;
    case 'node':
      return `Walkthrough step “${anchor.title}”, diagram node “${anchor.node}”`;
  }
}

function inlineComment(
  draft: DraftCommentView,
  diff: PullRequestDiff,
  parsed: Map<string, PatchLines | undefined>,
): InlineReviewComment | GeneralReviewComment['reason'] {
  const anchor = draft.anchor;
  if (anchor.kind !== 'lines') return anchor.kind;
  if (draft.outdated) return 'outdated';
  if (!parsed.has(anchor.path)) {
    const file = diff.files.find((entry) => entry.path === anchor.path);
    parsed.set(
      anchor.path,
      file?.patch === undefined ? undefined : patchLines(file.patch),
    );
  }
  const lines = parsed.get(anchor.path)?.[anchor.side];
  if (!lines) return 'not-in-pull-request';
  const texts: string[] = [];
  for (let line = anchor.start; line <= anchor.end; line += 1) {
    const entry = lines.get(line);
    if (!entry) return 'not-in-pull-request';
    texts.push(entry);
  }
  if (texts.join('\n') !== anchor.text) return 'not-in-pull-request';
  return {
    id: draft.id,
    path: anchor.path,
    side: anchor.side === 'additions' ? 'RIGHT' : 'LEFT',
    ...(anchor.start < anchor.end ? { startLine: anchor.start } : {}),
    line: anchor.end,
    body: draft.text,
  };
}

export function planPullRequestReview(
  drafts: readonly DraftCommentView[],
  diff: PullRequestDiff,
): ReviewPlan {
  const parsed = new Map<string, PatchLines | undefined>();
  const inline: InlineReviewComment[] = [];
  const general: GeneralReviewComment[] = [];
  for (const draft of drafts) {
    if (draft.publication.status !== 'draft') continue;
    const placed = inlineComment(draft, diff, parsed);
    if (typeof placed === 'string')
      general.push({
        id: draft.id,
        location: commentLocation(draft.anchor),
        reason: placed,
        body: draft.text,
      });
    else inline.push(placed);
  }
  return { inline, general };
}

function reviewBody(
  summary: string,
  general: readonly Pick<GeneralReviewComment, 'location' | 'body'>[],
): string {
  const parts = summary.trim() ? [summary.trim()] : [];
  for (const comment of general)
    parts.push(`**${comment.location}**\n\n${comment.body.trim()}`);
  return parts.join('\n\n');
}

function fence(text: string) {
  const longest = Math.max(
    2,
    ...[...text.matchAll(/`+/g)].map((match) => match[0].length),
  );
  const ticks = '`'.repeat(longest + 1);
  return `${ticks}\n${text}\n${ticks}`;
}

function anchorGroup(anchor: DraftCommentAnchor): string {
  switch (anchor.kind) {
    case 'lines':
    case 'file':
      return `\`${anchor.path}\``;
    case 'step':
    case 'node':
      return `Walkthrough step “${anchor.title}”`;
  }
}

function itemHeading(draft: DraftCommentView): string {
  const anchor = draft.anchor;
  const outdated = draft.outdated
    ? ' (outdated: these lines changed after the comment was written)'
    : '';
  switch (anchor.kind) {
    case 'lines':
      return `### ${anchor.side === 'deletions' ? 'Removed lines' : anchor.start === anchor.end ? 'Line' : 'Lines'} ${lineRange(anchor.start, anchor.end)}${outdated}`;
    case 'file':
      return '### Whole file';
    case 'step':
      return '### The step';
    case 'node':
      return `### Diagram node “${anchor.node}”`;
  }
}

export function draftCommentsMarkdown(input: {
  readonly branch: string;
  readonly headOid: string;
  readonly comments: readonly DraftCommentView[];
  readonly command: string;
}): string {
  const open = input.comments.filter(
    (comment) => comment.publication.status === 'draft',
  );
  const lines = [
    `# Review comments on \`${input.branch}\``,
    '',
    `Head commit \`${input.headOid}\`. ${open.length === 1 ? '1 comment' : `${open.length} comments`} to address. Line numbers refer to the file at that commit; removed lines refer to the base.`,
  ];
  const groups = new Map<string, DraftCommentView[]>();
  for (const comment of open) {
    const key = anchorGroup(comment.anchor);
    groups.set(key, [...(groups.get(key) ?? []), comment]);
  }
  for (const [group, comments] of groups) {
    lines.push('', `## ${group}`);
    for (const comment of comments) {
      lines.push('', itemHeading(comment));
      if (comment.anchor.kind === 'lines')
        lines.push('', fence(comment.anchor.text));
      lines.push('', comment.text.trim());
    }
  }
  if (open.length === 0) lines.push('', 'No open comments.');
  lines.push(
    '',
    '---',
    '',
    `Print these comments again from this worktree with \`${input.command}\`.`,
  );
  return `${lines.join('\n')}\n`;
}

export function reviewPayload(plan: ReviewPlan, summary: string) {
  const ids = [...plan.inline, ...plan.general].map((comment) => comment.id);
  const comments = plan.inline.map(({ id: _id, ...comment }) => comment);
  const body = reviewBody(summary, plan.general);
  return {
    ids,
    body:
      body ||
      (comments.length === 1
        ? '1 inline comment.'
        : `${comments.length} inline comments.`),
    comments,
  };
}
