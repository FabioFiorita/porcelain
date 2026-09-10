import type {
  CommitReviewLayerRequest,
  CommitReviewLayers,
} from '../../models/commit-review-layers.ts';
import type { ReviewLayer } from '../../models/review-layers.ts';
import { CommitReviewLayerConflictError } from '../errors/commit-review-layer-conflict-error.ts';
import { InvalidCommitReviewLayersError } from '../errors/invalid-commit-review-layers-error.ts';

function referenceKey(reference: ReviewLayer['files'][number]) {
  return JSON.stringify([reference.path, reference.scope]);
}
export function selectLayers(
  layers: ReviewLayer[],
  references: ReviewLayer['files'],
) {
  const selected = new Set(references.map(referenceKey));
  if (
    references.length === 0 ||
    references.length > 500 ||
    new Set(references.map((reference) => reference.path)).size !==
      references.length
  )
    throw new InvalidCommitReviewLayersError();
  const result = layers
    .map((layer) => ({
      ...layer,
      files: layer.files.filter((file) => selected.has(referenceKey(file))),
    }))
    .filter((layer) => layer.files.length > 0);
  if (
    result.reduce((count, layer) => count + layer.files.length, 0) !==
    selected.size
  )
    throw new InvalidCommitReviewLayersError();
  return result;
}
export function retryAssociation(
  existing: CommitReviewLayers,
  request: CommitReviewLayerRequest,
) {
  const saved = existing.layers
    .flatMap((layer) => layer.files)
    .map(referenceKey)
    .sort();
  const requested = request.references.map(referenceKey).sort();
  if (
    existing.sourceWorktreeId !== request.sourceWorktreeId ||
    existing.sourceRevision !== request.sourceRevision ||
    existing.parentNumber !== request.parentNumber ||
    JSON.stringify(saved) !== JSON.stringify(requested)
  )
    throw new CommitReviewLayerConflictError();
  return existing;
}
