import { omissionReason } from '@porcelain/client/changes/rules';
import type { DiffContent } from '@porcelain/client/changes/rules';
import { patchLines } from '@porcelain/client/changes/rules';

export function diffPresentation(content: DiffContent) {
  if (content.kind === 'binary')
    return {
      kind: 'notice' as const,
      title: 'Binary change',
      description: 'This comparison cannot be displayed as text.',
    };
  if (content.kind === 'metadata-only')
    return { kind: 'metadata' as const, source: content.patch };
  if (content.kind === 'omitted')
    return {
      kind: 'notice' as const,
      title: 'Diff unavailable',
      description: omissionReason(content.reason),
    };
  const parsed = patchLines(content.patch);
  if (parsed.kind === 'text') return parsed;
  return parsed.kind === 'empty'
    ? {
        kind: 'notice' as const,
        title: 'No text changes',
        description: 'This comparison contains no changed text lines.',
      }
    : {
        kind: 'notice' as const,
        title: 'Diff unavailable',
        description: 'The server returned a patch that could not be displayed.',
      };
}
