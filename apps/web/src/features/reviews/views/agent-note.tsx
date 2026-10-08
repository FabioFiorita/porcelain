import { MarkdownView } from '@/features/files/index';

export function AgentNote({
  title,
  text,
  stale = false,
}: {
  title?: string;
  text: string;
  stale?: boolean;
}) {
  return (
    <details className="m-3 border-l-2 border-muted-foreground/30 pl-3 font-sans text-sm">
      <summary className="cursor-pointer text-muted-foreground">
        Agent note{title ? ` · ${title}` : ''}
      </summary>
      {stale && (
        <p role="status" className="mt-2 text-graph-4">
          Code changed since the review was written.
        </p>
      )}
      <MarkdownView text={text} className="mt-2 text-sm" />
    </details>
  );
}
