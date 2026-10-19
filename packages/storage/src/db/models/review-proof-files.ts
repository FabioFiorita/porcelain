import { Schema } from 'effect';
import { Model } from 'effect/schema';
import { proofMediaTypeSchema } from '@porcelain/reviews/models';
export class ProofFileRow extends Model.Class<ProofFileRow>('ProofFileRow')({
  reviewId: Schema.String,
  revision: Schema.Int,
  id: Schema.String,
  mediaType: proofMediaTypeSchema,
  bytes: Schema.Uint8Array,
}) {
  static readonly tableName = 'review_proof_files';
}
