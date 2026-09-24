import type { ReadReviewTextInput } from '../../src/models/read-review-evidence.ts';
import type { ReviewText } from '../../src/models/review-evidence.ts';
import type { ReviewTextReader } from '../../src/ports/review-text-reader.ts';

export class InMemoryReviewTextReader implements ReviewTextReader {
  private readonly texts: ReadonlyMap<string, string>;

  constructor(texts: ReadonlyMap<string, string>) {
    this.texts = texts;
  }

  async execute(input: ReadReviewTextInput): Promise<ReviewText> {
    return { path: input.path, text: this.texts.get(input.path) ?? '' };
  }
}
