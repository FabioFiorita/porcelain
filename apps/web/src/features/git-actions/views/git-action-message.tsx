import { TriangleAlertIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function GitActionMessage({ text }: { text: string }) {
  return text.split(/`([^`\n]+)`/).map((part, index) =>
    index % 2 ? (
      <code
        key={index}
        className="box-decoration-clone rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]"
      >
        {part}
      </code>
    ) : (
      part
    ),
  );
}

export function GitActionError({
  text,
  children,
}: {
  text: string;
  children?: ReactNode;
}) {
  return (
    <p role="alert" className="flex min-w-0 gap-1.5 text-destructive">
      <TriangleAlertIcon className="mt-[0.2lh] size-3.5 shrink-0" />
      <span className="min-w-0 break-words">
        <GitActionMessage text={text} />
        {children}
      </span>
    </p>
  );
}
