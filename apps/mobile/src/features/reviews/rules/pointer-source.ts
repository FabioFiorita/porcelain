import {
  reviewStepLines,
  type ReviewStep,
} from '@porcelain/client/reviews/rules';
import type { RenderLine } from '../../../shared/rules/render-model';

export function pointerSource(
  step: ReviewStep,
  text: string,
  whole: boolean,
): RenderLine[] {
  const range = reviewStepLines(step);
  const lines = text.replaceAll('\r\n', '\n').split('\n');
  const start = whole ? 1 : Math.max(1, range.startLine - 3);
  const end = whole ? lines.length : range.endLine + 3;
  return lines.slice(start - 1, end).map((text, index) => ({
    id: String(start + index),
    text,
    newLine: start + index,
  }));
}
