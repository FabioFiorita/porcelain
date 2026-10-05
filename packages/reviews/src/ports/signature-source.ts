import { Context } from 'effect';
import { type SignatureRequest } from '../models/review.ts';

export interface SignatureSource {
  sign(input: SignatureRequest): string;
}

export const SignatureSource = Context.Service<
  '@porcelain/reviews/SignatureSource',
  SignatureSource
>('@porcelain/reviews/SignatureSource');
