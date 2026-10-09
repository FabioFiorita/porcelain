import { useEffect, useState } from 'react';
import { useUniwind } from 'uniwind';
import type { RenderToken } from '../../shared/rules/render-model';

const highlighter = __DEV__
  ? Promise.all([
      import('./code-highlighter'),
      import('react-native-shiki-engine'),
    ])
      .then(([{ createCodeHighlighter }, { createNativeEngine }]) =>
        createCodeHighlighter(createNativeEngine()),
      )
      .then(
        (value) => ({ value }),
        () => ({ value: undefined }),
      )
  : undefined;
function nextFrame(signal: AbortSignal): Promise<void> {
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
    if (!language || !highlighter) return;
    const controller = new AbortController();
    void highlighter
      .then(({ value }) => {
        if (!value) throw new Error('Syntax highlighting could not load.');
        return value(source, language, scheme, controller.signal, () =>
          nextFrame(controller.signal),
        );
      })
      .then((tokens) => {
        if (!controller.signal.aborted)
          setResult({ source, language, scheme, tokens });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setResult({
            source,
            language,
            scheme,
            error: 'Syntax highlighting could not load.',
          });
      });
    return () => controller.abort();
  }, [source, language, scheme]);
  return result?.source === source &&
    result.language === language &&
    result.scheme === scheme
    ? result
    : undefined;
}
