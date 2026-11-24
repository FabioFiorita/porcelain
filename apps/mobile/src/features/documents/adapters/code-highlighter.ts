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
import type { RenderToken } from '../../../shared/rules/render-model.js';
import { highlightCode } from '../../../shared/rules/highlight-code.ts';

export function nextFrame(signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      signal.removeEventListener('abort', abort);
      resolve();
    };
    const frame = requestAnimationFrame(finish);
    const abort = () => {
      cancelAnimationFrame(frame);
      finish();
    };
    signal.addEventListener('abort', abort, { once: true });
  });
}

const languageBundles = new Map(
  [
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
  ]
    .sort((left, right) => right.length - left.length)
    .flatMap((bundle) =>
      bundle.flatMap(({ name, aliases }) =>
        [name, ...(aliases ?? [])].map((key) => [key, bundle] as const),
      ),
    ),
);

const MAX_BUSY_MS = 8;

export async function createCodeHighlighter(
  engine: RegexEngine,
  yieldToUI: (signal: AbortSignal) => Promise<void>,
) {
  const highlighter = await createHighlighterCore({
    engine,
    themes: [pierreLight, pierreDark].map((theme) => ({
      name: theme.name,
      type: theme.type,
      colors: theme.colors,
      tokenColors: [...theme.tokenColors],
    })),
    langs: [],
  });
  return async (
    source: string,
    language: string | undefined,
    scheme: 'light' | 'dark',
    signal: AbortSignal,
  ): Promise<RenderToken[][]> => {
    if (signal.aborted) return [];
    await yieldToUI(signal);
    if (signal.aborted) return [];
    const lang = language?.toLowerCase();
    const bundle = lang ? languageBundles.get(lang) : undefined;
    if (lang && bundle && !highlighter.getLoadedLanguages().includes(lang))
      highlighter.loadLanguageSync(...bundle);
    let grammarState: GrammarState | undefined;
    const tokenize =
      lang && bundle
        ? (chunk: string) => {
            const tokens = highlighter.codeToTokensBase(chunk, {
              lang,
              theme: `pierre-${scheme}`,
              ...(grammarState ? { grammarState } : {}),
            });
            grammarState = highlighter.getLastGrammarState(tokens);
            return tokens;
          }
        : undefined;
    let resumedAt = performance.now();
    return highlightCode(source, tokenize, signal, async () => {
      if (performance.now() - resumedAt < MAX_BUSY_MS) return;
      await yieldToUI(signal);
      resumedAt = performance.now();
    });
  };
}
