import { useVirtualizer } from '@tanstack/react-virtual';
import { useMemo, useRef } from 'react';
import { highlightedLines } from '../../lib/code-highlight';
import { codeThemeCss } from '../../lib/code-theme';
import { highlightedDiffLines } from '../../lib/diff-highlight';
export function CodePreview({
  text,
  language,
  format = 'code',
}: {
  text: string;
  language: string;
  format?: 'code' | 'diff';
}) {
  const scroll = useRef<HTMLElement>(null);
  const lines = useMemo(
    () =>
      format === 'diff'
        ? highlightedDiffLines(text, language)
        : highlightedLines(text, language).map((tokens, index) => ({
            tokens,
            kind: 'context',
            oldNumber: null,
            newNumber: index + 1,
            marker: '',
          })),
    [text, language, format],
  );
  const virtual = useVirtualizer({
    count: lines.length,
    getScrollElement: () => scroll.current,
    estimateSize: () => 24,
    scrollMargin: format === 'diff' ? 28 : 0,
    overscan: 12,
  });
  return (
    <section
      ref={scroll}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: Virtual code viewport must support keyboard scrolling.
      tabIndex={0}
      aria-label="Read-only code"
      className="review-code h-[min(65svh,48rem)] overflow-auto border-y bg-background font-mono text-xs leading-6 focus-visible:outline-2 focus-visible:outline-ring"
    >
      <style href="porcelain-code-theme" precedence="default">
        {codeThemeCss}
      </style>
      {format === 'diff' && (
        <div className="sticky left-0 top-0 z-10 flex h-7 min-w-full items-center border-b bg-background font-sans text-[10px] text-muted-foreground">
          <span
            className="w-10 shrink-0 pr-2 text-right"
            title="Original file line"
          >
            Old
          </span>
          <span
            className="w-10 shrink-0 border-r pr-2 text-right"
            title="Updated file line"
          >
            New
          </span>
          <span className="pl-4">Changes</span>
        </div>
      )}
      <div
        className="relative min-w-full"
        style={{ height: virtual.getTotalSize() }}
      >
        {virtual.getVirtualItems().map((row) => (
          <div
            key={row.key}
            data-change={lines[row.index]?.kind}
            className="review-code-line absolute left-0 flex min-w-full whitespace-pre"
            style={{
              top: row.start - (format === 'diff' ? 28 : 0),
              height: row.size,
            }}
          >
            <span
              aria-hidden="true"
              className="review-code-gutter sticky left-0 mr-4 flex shrink-0 select-none border-r bg-background text-right text-muted-foreground"
            >
              {format === 'diff' && (
                <span className="w-10 pr-2">{lines[row.index]?.oldNumber}</span>
              )}
              <span className="w-10 pr-2">{lines[row.index]?.newNumber}</span>
            </span>
            {format === 'diff' && (
              <span aria-hidden="true" className="w-5 shrink-0 select-none">
                {lines[row.index]?.marker}
              </span>
            )}
            <code
              className={
                lines[row.index]?.kind === 'meta'
                  ? 'pr-8 font-sans text-xs'
                  : 'pr-8'
              }
            >
              {lines[row.index]?.tokens.map((token) => (
                <span
                  key={token.offset}
                  className={`th-${token.className || 'token'}`}
                >
                  {token.value}
                </span>
              ))}
            </code>
          </div>
        ))}
      </div>
    </section>
  );
}
