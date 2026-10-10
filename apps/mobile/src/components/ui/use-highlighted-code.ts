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
      try {
        const value = await highlighter;
        if (!value) throw new Error('Syntax highlighting could not load.');
        const tokens = await value(source, language, scheme, controller.signal);
        if (!controller.signal.aborted)
          setResult({ source, language, scheme, tokens });
      } catch {
        if (!controller.signal.aborted)
          setResult({
            source,
            language,
            scheme,
            error: 'Syntax highlighting could not load.',
          });
      }
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
