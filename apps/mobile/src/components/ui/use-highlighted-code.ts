import { useAtomValue } from '@effect/atom-react';
import { Effect, Option } from 'effect';
import { Atom, AsyncResult } from 'effect/reactivity';
import { useUniwind } from 'uniwind';

import { createCodeHighlighter } from './code-highlighter';
import { createNativeEngine } from 'react-native-shiki-engine';
import { isHighlightable } from '../../shared/rules/highlight-code';
import type { RenderToken } from '../../shared/rules/render-model';

type HighlightedCode = {
  source: string;
  tokens?: readonly (readonly RenderToken[])[];
  error?: string;
};

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
      Effect.promise(async (signal): Promise<HighlightedCode | undefined> => {
        if (!language) return undefined;
        const tokens = await highlightTokens(source, language, scheme, signal);
        return tokens
          ? { source, tokens }
          : { source, error: 'Syntax highlighting could not load.' };
      }),
    ).pipe(Atom.setIdleTTL('5 minutes')),
);

export function useHighlightedCode(
  source: string,
  language: string | undefined,
): HighlightedCode | undefined {
  const { theme } = useUniwind();
  const scheme = theme === 'dark' ? 'dark' : 'light';
  const highlighted =
    language && isHighlightable(source) ? language : undefined;
  const result = Option.getOrUndefined(
    AsyncResult.value(
      useAtomValue(highlightedCode({ source, language: highlighted, scheme })),
    ),
  );
  return highlighted ? result : { source };
}
