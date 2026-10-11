import { useEffect, useState } from 'react';
import { useUniwind } from 'uniwind';
import type { RenderToken } from '../../shared/rules/render-model';

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
export function useHighlightedCode(source: string, language?: string) {
  const { theme } = useUniwind();
  const scheme = theme === 'dark' ? 'dark' : 'light';
  const [result, setResult] = useState<{
    source: string;
    language: string | undefined;
    scheme: string;
    tokens?: RenderToken[][];
    error?: string;
  }>();
  useEffect(() => {
    if (!language) return;
    const controller = new AbortController();
    async function highlight() {
      const tokens = await highlightTokens(
        source,
        language,
        scheme,
        controller.signal,
      );
      if (!controller.signal.aborted)
        setResult(
          tokens
            ? { source, language, scheme, tokens }
            : {
                source,
                language,
                scheme,
                error: 'Syntax highlighting could not load.',
              },
        );
    }
    void highlight();
    return () => controller.abort();
  }, [source, language, scheme]);
  return result?.source === source &&
    result.language === language &&
    result.scheme === scheme
    ? result
    : undefined;
}
