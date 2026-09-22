import { TriangleAlertIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * A Git action message as the server words it. Settings, paths and commands
 * are marked with backticks, so the owner can tell `filter.lfs.process` from
 * the sentence around it.
 */
export function GitActionMessage({ text }: { text: string }) {
  return text.split(/`([^`\n]+)`/).map((part, index) =>
    index % 2 ? (
      <code
        // biome-ignore lint/suspicious/noArrayIndexKey: parts of a fixed string
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

/** Why a Git action did not run, beside the form that asked for it. */
export function GitActionError({
  text,
  children,
}: {
  text: string;
  children?: ReactNode;
}) {
  return (
    <p role="alert" className="flex gap-2 text-sm text-destructive">
      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
      <span>
        <GitActionMessage text={text} />
        {children}
      </span>
    </p>
  );
}
