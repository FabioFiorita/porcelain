import { Context, type Effect } from 'effect';

export interface ReviewCodeReader {
  readText(input: {
    commonDirectory: string;
    oid: string;
    path: string;
  }): Effect.Effect<
    | { kind: 'text'; text: string; blobOid: string }
    | { kind: 'missing' }
    | { kind: 'too-large' | 'unsupported'; blobOid: string }
  >;
}
export const ReviewCodeReader = Context.Service<
  '@porcelain/reviews/ReviewCodeReader',
  ReviewCodeReader
>('@porcelain/reviews/ReviewCodeReader');
