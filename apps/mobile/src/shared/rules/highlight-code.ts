import type { RenderToken } from './render-model.js';

type SyntaxToken = { content: string; color?: string; fontStyle?: number };
export async function highlightCode(
  source: string,
  tokenize: ((chunk: string) => SyntaxToken[][]) | undefined,
  signal?: AbortSignal,
  yieldToUI: () => Promise<void> = () => Promise.resolve(),
): Promise<RenderToken[][]> {
  const lines = source.replaceAll('\r\n', '\n').split('\n');
  if (!tokenize) {
    return lines.map((text) => (text ? [{ text }] : []));
  }
  const result: RenderToken[][] = [];
  for (let start = 0; start < lines.length; start += 100) {
    if (signal?.aborted) return [];
    const tokens = tokenize(lines.slice(start, start + 100).join('\n'));
    result.push(
      ...tokens.map((line) =>
        line
          .filter((token) => token.content.length > 0)
          .map((token) => ({
            text: token.content,
            ...(token.color
              ? {
                  color:
                    (0xff000000 + Number.parseInt(token.color.slice(1), 16)) >>>
                    0,
                }
              : {}),
            ...(token.fontStyle ? { fontStyle: token.fontStyle } : {}),
          })),
      ),
    );
    if (start + 100 < lines.length) await yieldToUI();
  }
  return result;
}
