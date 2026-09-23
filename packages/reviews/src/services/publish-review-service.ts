import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { ReviewPublication } from '../models/published-review.ts';
import type {
  StoredReview,
  StoredReviewLayer,
  StoredReviewStep,
} from '../models/stored-review.ts';
import type { ReviewStore } from '../ports/review-store.ts';

export class PublishReviewService {
  private readonly store: ReviewStore;
  private readonly now: () => string;

  constructor(
    store: ReviewStore,
    now: () => string = () => new Date().toISOString(),
  ) {
    this.store = store;
    this.now = now;
  }

  execute(
    worktreeId: string,
    input: ReviewPublication,
    published: readonly (readonly (readonly string[])[])[],
  ): StoredReview {
    const layers: StoredReviewLayer[] = input.layers.map(
      (layer, layerIndex) => {
        const steps: StoredReviewStep[] = layer.steps.map(
          (step, stepIndex) => ({
            ...structuredClone(step),
            published: [...(published[layerIndex]?.[stepIndex] ?? [])],
          }),
        );
        return {
          ...structuredClone(layer),
          steps,
          fingerprint: fingerprint(
            steps
              .filter((step) => step.kind === 'changed')
              .map((step) => `${step.id}:${step.published.join('\n')}`)
              .join('\0'),
          ),
        };
      },
    );
    const stored: StoredReview = {
      worktreeId,
      revision: input.expectedRevision + 1,
      publishedAt: this.now(),
      active: true,
      summaryHtml: input.summaryHtml,
      summaryToken: randomUUID(),
      summarySecret: randomBytes(32).toString('hex'),
      ...(input.diagram === undefined
        ? {}
        : { diagram: structuredClone(input.diagram) }),
      layers,
    };
    this.store.replace(stored, input.expectedRevision);
    return stored;
  }
}

function fingerprint(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
