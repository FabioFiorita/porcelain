import { omissionReason } from '@porcelain/client/changes/rules';
import type { DiffContent } from '@porcelain/client/changes/rules';
import { diffLines } from '@porcelain/client/changes/rules';

export function diffPresentation(content: DiffContent) {
  if (content.kind === 'binary')
    return {
      kind: 'notice' as const,
      title: 'Binary change',
    };
  if (content.kind === 'metadata-only')
    return { kind: 'metadata' as const, source: content.patch };
  if (content.kind === 'omitted')
    return {
      kind: 'notice' as const,
      title: omissionReason(content.reason),
    };
  const parsed = diffLines(content.patch);
  if (parsed.kind === 'text') return parsed;
  return parsed.kind === 'empty'
    ? {
        kind: 'notice' as const,
        title: 'No text changes',
      }
    : {
        kind: 'notice' as const,
        title: 'This diff could not be displayed.',
      };
}
