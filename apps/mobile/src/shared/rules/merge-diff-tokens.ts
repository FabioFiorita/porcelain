import type { RenderToken } from './render-model.ts';

export function mergeDiffTokens(
  syntax: readonly RenderToken[],
  annotations?: readonly RenderToken[],
): readonly RenderToken[] {
  if (
    !annotations ||
    syntax.map((token) => token.text).join('') !==
      annotations.map((token) => token.text).join('')
  )
    return syntax;
  let annotationEnd = 0;
  const spans = annotations.map((token) => {
    annotationEnd += token.text.length;
    return { token, end: annotationEnd };
  });
  let offset = 0;
  let spanIndex = 0;
  return syntax.flatMap((token) => {
    const parts: RenderToken[] = [];
    const end = offset + token.text.length;
    const start = offset;
    while (offset < end) {
      let span = spans[spanIndex];
      while (span && span.end <= offset) {
        spanIndex++;
        span = spans[spanIndex];
      }
      const next = Math.min(end, span?.end ?? end);
      parts.push({
        ...token,
        ...span?.token,
        text: token.text.slice(offset - start, next - start),
      });
      offset = next;
    }
    return parts;
  });
}
