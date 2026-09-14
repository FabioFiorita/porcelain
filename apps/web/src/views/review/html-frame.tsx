import { cn } from '@/lib/utils';
import { useTheme } from '../workspace/theme';

/**
 * Agent HTML is rendered in an opaque-origin sandbox. Scripts can make the
 * report interactive, but without same-origin access it cannot reach this
 * page's storage or review API.
 */
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
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      srcDoc={html}
      style={{ colorScheme: dark ? 'dark' : 'light' }}
      className={cn(
        'block min-h-[32rem] w-full border-0 bg-transparent',
        className,
      )}
    />
  );
}
