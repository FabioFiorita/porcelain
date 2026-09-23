import { createHmac, timingSafeEqual } from 'node:crypto';
import type { ReviewStore } from '../ports/review-store.ts';

export class ReadReviewSummaryService {
  private readonly store: ReviewStore;

  constructor(store: ReviewStore) {
    this.store = store;
  }

  execute(
    token: string,
    expires: number,
    signature: string,
  ): string | undefined {
    const summary = this.store.readSummary(token);
    if (
      summary === undefined ||
      !Number.isSafeInteger(expires) ||
      expires < Math.floor(Date.now() / 1000)
    )
      return undefined;
    const expected = Buffer.from(
      createHmac('sha256', summary.summarySecret)
        .update(`${token}\0${expires}`)
        .digest('base64url'),
    );
    const supplied = Buffer.from(signature);
    return expected.length === supplied.length &&
      timingSafeEqual(expected, supplied)
      ? summary.summaryHtml
      : undefined;
  }
}
