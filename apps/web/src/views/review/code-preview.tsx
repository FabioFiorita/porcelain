import { useVirtualizer } from '@tanstack/react-virtual';
import { useMemo, useRef } from 'react';
import { highlightedLines } from '../../lib/code-highlight';
export function CodePreview({
  text,
  language,
}: {
  text: string;
  language: string;
}) {
  const scroll = useRef<HTMLElement>(null);
  const lines = useMemo(
    () => highlightedLines(text, language),
    [text, language],
  );
  const virtual = useVirtualizer({
    count: lines.length,
    getScrollElement: () => scroll.current,
    estimateSize: () => 24,
    overscan: 12,
  });
  return (
    <section
      ref={scroll}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: Virtual code viewport must support keyboard scrolling.
      tabIndex={0}
      aria-label="Read-only code"
      className="h-[min(65svh,48rem)] overflow-auto border-y bg-background font-mono text-xs leading-6 focus-visible:outline-2 focus-visible:outline-ring"
    >
      <div
        className="relative min-w-full"
        style={{ height: virtual.getTotalSize() }}
      >
        {virtual.getVirtualItems().map((row) => (
          <div
            key={row.key}
            className="absolute left-0 flex min-w-full whitespace-pre"
            style={{ top: row.start, height: row.size }}
          >
            <span
              aria-hidden="true"
              className="sticky left-0 mr-5 w-12 shrink-0 select-none border-r bg-background pr-3 text-right text-muted-foreground"
            >
              {row.index + 1}
            </span>
            <code className="pr-8">
              {lines[row.index]?.map((token) => (
                <span
                  key={token.offset}
                  className={`review-token ${token.className}`}
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
