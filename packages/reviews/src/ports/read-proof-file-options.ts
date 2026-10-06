import { Context } from 'effect';
import type { ReadProofFileOptions as ReadProofFileOptionsShape } from '../models/read-proof-file.ts';
export const ReadProofFileOptions = Context.Service<
  '@porcelain/reviews/ReadProofFileOptions',
  ReadProofFileOptionsShape
>('@porcelain/reviews/ReadProofFileOptions');
