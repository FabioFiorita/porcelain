import { ReadReviewSummaryService } from '@porcelain/reviews/services';

export class ReadReviewSummaryController {
  private readonly summary: ReadReviewSummaryService;
  private readonly assertOpen: () => void;

  constructor(summary: ReadReviewSummaryService, assertOpen: () => void) {
    this.summary = summary;
    this.assertOpen = assertOpen;
  }

  execute(input: {
    token: string;
    expires: number;
    signature: string;
  }): string | null {
    this.assertOpen();
    return (
      this.summary.execute(input.token, input.expires, input.signature) ?? null
    );
  }
}
