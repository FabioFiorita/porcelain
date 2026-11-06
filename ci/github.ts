import { execFileSync } from 'node:child_process';
import { Schema } from 'effect';

const IssueComment = Schema.Struct({
  id: Schema.Int,
  body: Schema.String,
  user: Schema.NullOr(Schema.Struct({ type: Schema.String })),
});

const PullRequestAuthor = Schema.Struct({ author_association: Schema.String });
const trustedAssociations = new Set(['OWNER', 'COLLABORATOR']);

export function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value)
    throw new Error(`${name} must be set; its CI workflow provides it`);
  return value;
}

export function gh(args: readonly string[], input?: string): string {
  return execFileSync('gh', [...args], {
    encoding: 'utf8',
    ...(input === undefined ? {} : { input }),
  });
}

export function pages<A>(
  page: Schema.Codec<A, unknown>,
  path: string,
): readonly A[] {
  return Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Array(page)))(
    gh(['api', '--paginate', '--slurp', path]),
  );
}

export function upsertComment(
  repository: string,
  number: number,
  marker: string,
  body: string,
): void {
  const existing = pages(
    Schema.Array(IssueComment),
    `repos/${repository}/issues/${number}/comments`,
  )
    .flat()
    .find(
      (comment) =>
        comment.user?.type === 'Bot' && comment.body.startsWith(marker),
    );
  gh(
    existing
      ? [
          'api',
          '--method',
          'PATCH',
          `repos/${repository}/issues/comments/${existing.id}`,
          '--input',
          '-',
        ]
      : [
          'api',
          '--method',
          'POST',
          `repos/${repository}/issues/${number}/comments`,
          '--input',
          '-',
        ],
    JSON.stringify({ body }),
  );
}

export function trustedAuthor(repository: string, number: number): boolean {
  const pull = Schema.decodeUnknownSync(
    Schema.fromJsonString(PullRequestAuthor),
  )(gh(['api', `repos/${repository}/pulls/${number}`]));
  return trustedAssociations.has(pull.author_association);
}
