import {
  createHighlighterCore,
  type RegexEngine,
  type GrammarState,
} from 'shiki/core';
import pierreLight from '@pierre/theme/pierre-light';
import pierreDark from '@pierre/theme/pierre-dark';
import bash from '@shikijs/langs/bash';
import javascript from '@shikijs/langs/javascript';
import typescript from '@shikijs/langs/typescript';
import jsx from '@shikijs/langs/jsx';
import tsx from '@shikijs/langs/tsx';
import json from '@shikijs/langs/json';
import yaml from '@shikijs/langs/yaml';
import python from '@shikijs/langs/python';
import swift from '@shikijs/langs/swift';
import kotlin from '@shikijs/langs/kotlin';
import rust from '@shikijs/langs/rust';
import go from '@shikijs/langs/go';
import html from '@shikijs/langs/html';
import css from '@shikijs/langs/css';
import markdown from '@shikijs/langs/markdown';
import type { RenderToken } from './render-model.js';

export async function createCodeHighlighter(engine: RegexEngine) {
  const highlighter = await createHighlighterCore({
    engine,
    themes: [pierreLight, pierreDark].map((theme) => ({
      name: theme.name,
      type: theme.type,
      colors: theme.colors,
      tokenColors: [...theme.tokenColors],
    })),
    langs: [
      bash,
      javascript,
      typescript,
      jsx,
      tsx,
      json,
      yaml,
      python,
      swift,
      kotlin,
      rust,
      go,
      html,
      css,
      markdown,
    ],
  });
  return async (
    source: string,
    language: string | undefined,
    scheme: 'light' | 'dark',
    signal?: AbortSignal,
    yieldToUI: () => Promise<void> = () => Promise.resolve(),
  ): Promise<RenderToken[][]> => {
    const lines = source.replaceAll('\r\n', '\n').split('\n');
    if (
      !language ||
      !highlighter.getLoadedLanguages().includes(language.toLowerCase())
    ) {
      return lines.map((text) => (text ? [{ text }] : []));
    }
    const result: RenderToken[][] = [];
    let grammarState: GrammarState | undefined;
    for (let start = 0; start < lines.length; start += 100) {
      if (signal?.aborted) return [];
      const tokens = highlighter.codeToTokensBase(
        lines.slice(start, start + 100).join('\n'),
        {
          lang: language.toLowerCase(),
          theme: `pierre-${scheme}`,
          ...(grammarState ? { grammarState } : {}),
        },
      );
      grammarState = highlighter.getLastGrammarState(tokens);
      result.push(
        ...tokens.map((line) =>
          line
            .filter((token) => token.content.length > 0)
            .map((token) => ({
              text: token.content,
              ...(token.color
                ? {
                    color:
                      (0xff000000 +
                        Number.parseInt(token.color.slice(1), 16)) >>>
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
  };
}

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
