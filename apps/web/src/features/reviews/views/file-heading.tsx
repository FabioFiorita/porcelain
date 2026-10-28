import type { FileDiffMetadata } from '@pierre/diffs';
import type { ReactNode } from 'react';
import { TruncatedText } from '@/shared/views/truncated-text';

export function FileHeading({
  path,
  note,
  diff,
  children,
}: {
  path: string;
  note?: string | undefined;
  diff?: FileDiffMetadata | undefined;
  children?: ReactNode;
}) {
  const parts = path.split('/');
  const name = parts.pop() ?? path;
  const additions = diff?.hunks.reduce(
    (total, hunk) => total + hunk.additionLines,
    0,
  );
  const deletions = diff?.hunks.reduce(
    (total, hunk) => total + hunk.deletionLines,
    0,
  );
  return (
    <header
      data-file-heading=""
      className="@container/file-heading flex min-h-11 shrink-0 items-center gap-2.5 px-4 text-ui leading-[1.4] whitespace-nowrap text-foreground"
    >
      <TruncatedText
        text={path}
        className="min-w-0 font-mono text-[length:var(--text-caption)] leading-4 text-muted-foreground"
        render={<h1 />}
      >
        {parts.length > 0 && (
          <span className="text-muted-foreground">{parts.join(' / ')} / </span>
        )}
        <span className="font-medium text-foreground">{name}</span>
      </TruncatedText>
      {note && (
        <span className="hidden shrink-0 text-xs text-muted-foreground @md/file-heading:inline">
          {note}
        </span>
      )}
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {diff && (
          <span
            aria-label={`${deletions} deletions, ${additions} additions`}
            className="font-mono text-xs font-medium tabular-nums"
          >
            <span className="text-del-fg">−{deletions}</span>{' '}
            <span className="text-add-fg">+{additions}</span>
          </span>
        )}
        {children}
      </div>
    </header>
  );
}
