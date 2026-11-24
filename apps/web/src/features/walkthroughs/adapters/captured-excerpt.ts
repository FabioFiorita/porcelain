import { processFile } from '@pierre/diffs';
import { focusPatch } from '@porcelain/client/changes/rules';
import type { WalkthroughExcerpt } from '@porcelain/client/walkthroughs/rules';

export function capturedExcerpt(patch: string, excerpt: WalkthroughExcerpt) {
  const focused = focusPatch(patch, [excerpt.span], 3, excerpt.side);
  if (!focused) return undefined;
  try {
    return processFile(focused, { throwOnError: true });
  } catch {
    return undefined;
  }
}
