import { Schema, Option } from 'effect';
import { createCommentThreadResponseSchema } from '@porcelain/contracts/reviews';
import type { CommentAnchor } from '@porcelain/client/reviews/rules';
import type { ReviewComparison } from './comparison';

export function reviewComparison(
  kind?: string,
  base?: string,
): ReviewComparison {
  return kind === 'branch'
    ? { kind: 'branch', ...(base ? { base } : {}) }
    : { kind: 'worktree' };
}

export function decodeCommentAnchor(value?: string): CommentAnchor | undefined {
  if (!value) return undefined;
  try {
    const result = Schema.decodeUnknownOption(
      createCommentThreadResponseSchema.fields.anchor,
    )(JSON.parse(value));
    return Option.isSome(result) ? result.value : undefined;
  } catch {
    return undefined;
  }
}

export function reviewParams(key: string, comparison: ReviewComparison) {
  return {
    workspace: key,
    comparison: comparison.kind,
    ...(comparison.kind === 'branch' && comparison.base
      ? { base: comparison.base }
      : {}),
  };
}
