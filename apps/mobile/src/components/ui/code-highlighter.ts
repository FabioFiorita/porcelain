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
import type { RenderToken } from '../../shared/rules/render-model.js';
import { highlightCode } from '../../shared/rules/highlight-code.ts';

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
    let grammarState: GrammarState | undefined;
    const tokenize =
      language &&
      highlighter.getLoadedLanguages().includes(language.toLowerCase())
        ? (chunk: string) => {
            const tokens = highlighter.codeToTokensBase(chunk, {
              lang: language.toLowerCase(),
              theme: `pierre-${scheme}`,
              ...(grammarState ? { grammarState } : {}),
            });
            grammarState = highlighter.getLastGrammarState(tokens);
            return tokens;
          }
        : undefined;
    return highlightCode(source, tokenize, signal, yieldToUI);
  };
}
