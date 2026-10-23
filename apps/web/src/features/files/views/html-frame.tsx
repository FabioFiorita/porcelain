import { cn } from '@/shared/lib/utils';
import { useTheme } from '@/features/preferences/index';
import { htmlFrameDocument } from '../adapters/html-assets';

export function HtmlFrame({
  html,
  title,
  className,
}: {
  html: string;
  title: string;
  className?: string;
}) {
  const { dark } = useTheme();
  return (
    <iframe
      title={title}
      aria-label={title}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      srcDoc={htmlFrameDocument(html)}
      style={{ colorScheme: dark ? 'dark' : 'light' }}
      className={cn(
        'block min-h-128 w-full border-0 bg-transparent',
        className,
      )}
    />
  );
}
