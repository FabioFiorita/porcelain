import type { SignatureRequest } from '../models/review.ts';

export interface SignatureSource {
  sign(input: SignatureRequest): string;
}
