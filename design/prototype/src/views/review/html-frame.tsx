import type { Ref } from 'react';
import { cn } from '@/lib/utils';
import { usePreferences } from '../workspace/preferences';

/**
 * The sandbox every agent or worktree HTML page runs in: scripts, forms, popups
 * and dialogs yes, same-origin no. The server serves the page from its own signed
 * link with the same sandbox header, so it can never read Porcelain's storage,
 * cookies or API, while CDNs and fonts load freely.
 */
export const HTML_SANDBOX =
  'allow-scripts allow-forms allow-popups allow-modals';

/**
 * An HTML page from a signed link (the review summary, a worktree file's preview).
 * It fills the box it is given and scrolls inside it. `#theme=light|dark` tells the
 * page Porcelain's theme; changing it is a fragment change, so the page never reloads.
 */
export function HtmlFrame({
  src,
  title,
  className,
  frameRef,
}: {
  src: string;
  title: string;
  className?: string;
  frameRef?: Ref<HTMLIFrameElement>;
}) {
  const { resolvedTheme } = usePreferences();
  return (
    <iframe
      ref={frameRef}
      title={title}
      sandbox={HTML_SANDBOX}
      referrerPolicy="no-referrer"
      src={`${src.split('#')[0]}#theme=${resolvedTheme}`}
      style={{ colorScheme: resolvedTheme }}
      className={cn('block w-full border-0 bg-transparent', className)}
    />
  );
}
