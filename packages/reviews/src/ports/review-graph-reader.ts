import { Context, type Effect } from 'effect';
import type { ModuleGraph } from '../models/review-system.ts';
export interface ReviewGraphReader {
  read(input: {
    commonDirectory: string;
    oid: string;
  }): Effect.Effect<ModuleGraph | undefined>;
}
export const ReviewGraphReader = Context.Service<
  '@porcelain/reviews/ReviewGraphReader',
  ReviewGraphReader
>('@porcelain/reviews/ReviewGraphReader');
