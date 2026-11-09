import {
  pullRequestChecks,
  pullRequestConversation,
  type PullRequestRead,
} from '@porcelain/client/reviews/rules';

type PullRequest = Extract<
  PullRequestRead,
  { kind: 'available' }
>['pullRequest'];

export function pullRequestMarkdown(pull: PullRequest) {
  return [
    '## Description',
    pull.description || 'No description provided.',
    pull.labels.length
      ? `Labels: ${pull.labels.map((label) => label.name).join(', ')}`
      : '',
    '## Checks',
    pullRequestChecks(pull.checks, pull.checksTruncated, pull.checksSummary)
      .label,
    ...pull.checks.map(
      (check) =>
        `- ${check.detailsUrl ? `[${check.name}](${check.detailsUrl})` : check.name}: ${check.conclusion ?? check.status}`,
    ),
    pull.checksTruncated
      ? 'Checks list is incomplete. Open on GitHub to read the remaining checks.'
      : '',
    '## Conversation',
    ...(pull.timeline.length
      ? pullRequestConversation(pull.timeline).flatMap(({ item, comments }) => [
          `### ${item.author ?? 'Unknown author'} · ${item.reviewState ?? item.kind} · ${item.time}`,
          item.path ? `${item.path}${item.line ? `:${item.line}` : ''}` : '',
          item.diffHunk ? `\`\`\`diff\n${item.diffHunk}\n\`\`\`` : '',
          item.body,
          ...comments.flatMap((comment) => [
            `#### ${comment.author ?? 'Unknown author'} · ${comment.path ?? ''}${comment.line ? `:${comment.line}` : ''}`,
            comment.diffHunk ? `\`\`\`diff\n${comment.diffHunk}\n\`\`\`` : '',
            comment.body,
          ]),
        ])
      : ['No conversation yet.']),
    pull.truncated
      ? 'Conversation is incomplete. Open on GitHub to read the remaining items.'
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}
