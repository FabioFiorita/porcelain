import type {
  ReadReviewTextsInput,
  ReadReviewTextsResult,
} from '../models/read-review-texts.ts';
import type { ReviewText } from '../models/review-evidence.ts';
import type { ReviewTextReader } from '../ports/review-text-reader.ts';

export class ReadReviewTextsService {
  private readonly textReader: ReviewTextReader;

  constructor(textReader: ReviewTextReader) {
    this.textReader = textReader;
  }

  async execute(
    input: ReadReviewTextsInput,
    signal?: AbortSignal,
  ): Promise<ReadReviewTextsResult> {
    const { worktreeId } = input;
    const found = await Promise.all(
      input.paths.map((path) =>
        this.textReader.execute({ worktreeId, path }, signal).then(
          (text): ReviewText[] => [text],
          (): ReviewText[] => [],
        ),
      ),
    );
    return new Map(found.flat().map((text) => [text.path, text.text]));
  }
}
