import { processFile } from '@pierre/diffs';
import { focusPatch } from '@porcelain/client/changes/rules';
import type { WalkthroughStop } from '@porcelain/client/walkthroughs/rules';

export function capturedExcerpt(
  patch: string,
  excerpt: WalkthroughStop['excerpts'][number],
) {
  const focused = focusPatch(
    patch,
    [{ startLine: excerpt.start, endLine: excerpt.end }],
    3,
    excerpt.side,
  );
  if (!focused) return undefined;
  try {
    return processFile(focused, { throwOnError: true });
  } catch {
    return undefined;
  }
}
