import { previewLinkHref } from '@porcelain/client/files/rules';
import { cn } from '@/shared/lib/utils';
import { useTheme } from '@/features/preferences/index';
import { htmlFrameDocument } from '../adapters/html-assets';

export function HtmlFrame({
  html,
  title,
  className,
  onLink,
  scripts,
}: {
  html: string;
  title: string;
  className?: string;
  onLink?: (href: string) => void;
  scripts: Parameters<typeof htmlFrameDocument>[1];
}) {
  const { dark } = useTheme();
  return (
    <iframe
      ref={(frame) => {
        if (!frame || !onLink) return;
        const listen = (event: MessageEvent) => {
          const page = frame.contentWindow?.frames[0];
          if (!page || event.source !== page) return;
          const href = previewLinkHref(event.data);
          if (href !== undefined) onLink(href);
        };
        window.addEventListener('message', listen);
        return () => window.removeEventListener('message', listen);
      }}
      title={title}
      aria-label={title}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      srcDoc={htmlFrameDocument(html, scripts)}
      style={{ colorScheme: dark ? 'dark' : 'light' }}
      className={cn(
        'block min-h-128 w-full border-0 bg-transparent',
        className,
      )}
    />
  );
}
