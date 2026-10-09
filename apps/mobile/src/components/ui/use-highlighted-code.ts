import { useEffect, useState } from 'react';
import { createNativeEngine } from 'react-native-shiki-engine';
import { useUniwind } from 'uniwind';
import { createCodeHighlighter } from './highlight-code';
import type { RenderToken } from './render-model';

const highlighter = Promise.resolve()
  .then(() => createCodeHighlighter(createNativeEngine()))
  .then(
    (value) => ({ value }),
    () => ({ value: undefined }),
  );
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
    if (!language) return;
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
