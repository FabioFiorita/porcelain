import type { ReviewPreviewResponse } from '@porcelain/contracts/comments';
import {
  reviewRequest,
  withReviewBody,
  type ReviewForm,
} from '../rules/comments.ts';

type ReviewPreview = Extract<ReviewPreviewResponse, { kind: 'available' }>;

export function reviewFormBinding(
  [form, update]: readonly [
    ReviewForm,
    (change: (form: ReviewForm) => ReviewForm) => void,
  ],
  preview: ReviewPreview,
) {
  return {
    summary: form.summary,
    body: (id: string) => form.bodies[id] ?? '',
    setSummary: (summary: string) =>
      update((current) => ({ ...current, summary })),
    edit: (id: string) => (text: string) =>
      update((current) => withReviewBody(current, id, text)),
    request: reviewRequest(form, preview),
  };
}
