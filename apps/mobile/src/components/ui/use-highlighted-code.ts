import { useAtomValue } from '@effect/atom-react';
import { Effect, Option } from 'effect';
import { Atom, AsyncResult } from 'effect/reactivity';
import { useUniwind } from 'uniwind';

import { createCodeHighlighter } from './code-highlighter';
import { createNativeEngine } from 'react-native-shiki-engine';

async function loadHighlighter() {
  try {
    return await createCodeHighlighter(createNativeEngine());
  } catch {
    return undefined;
  }
}
const highlighter = loadHighlighter();
async function highlightTokens(
  source: string,
  language: string | undefined,
  scheme: 'light' | 'dark',
  signal: AbortSignal,
) {
  try {
    const value = await highlighter;
    return await value?.(source, language, scheme, signal);
  } catch {
    return undefined;
  }
}
const highlightedCode = Atom.family(
  ({
    source,
    language,
    scheme,
  }: {
    source: string;
    language: string | undefined;
    scheme: 'light' | 'dark';
  }) =>
    Atom.make(
      Effect.promise(async (signal) => {
        if (!language) return undefined;
        const tokens = await highlightTokens(source, language, scheme, signal);
        return tokens
          ? { source, language, scheme, tokens }
          : {
              source,
              language,
              scheme,
              error: 'Syntax highlighting could not load.',
            };
      }),
    ),
);

export function useHighlightedCode(source: string, language?: string) {
  const { theme } = useUniwind();
  const scheme = theme === 'dark' ? 'dark' : 'light';
  return Option.getOrUndefined(
    AsyncResult.value(
      useAtomValue(highlightedCode({ source, language, scheme })),
    ),
  );
}
