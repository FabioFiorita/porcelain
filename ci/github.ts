import { execFileSync } from 'node:child_process';
import { Schema } from 'effect';

const IssueComment = Schema.Struct({
  id: Schema.Int,
  body: Schema.String,
  user: Schema.NullOr(Schema.Struct({ type: Schema.String })),
});

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
  item: Schema.Codec<A, unknown>,
  path: string,
): readonly A[] {
  return Schema.decodeUnknownSync(
    Schema.fromJsonString(Schema.Array(Schema.Array(item))),
  )(gh(['api', '--paginate', '--slurp', path])).flat();
}

export function upsertComment(
  repository: string,
  number: number,
  marker: string,
  body: string,
): void {
  const existing = pages(
    IssueComment,
    `repos/${repository}/issues/${number}/comments`,
  ).find(
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
