import { Context } from 'effect';
import type { ProofLimits as ProofLimitsShape } from '../models/review-proof.ts';
export const ProofLimits = Context.Service<
  '@porcelain/reviews/ProofLimits',
  ProofLimitsShape
>('@porcelain/reviews/ProofLimits');
