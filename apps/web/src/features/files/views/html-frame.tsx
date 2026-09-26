import { cn } from '@/shared/lib/utils';
import { useTheme } from '@/shared/workspace/theme';

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
      srcDoc={html}
      style={{ colorScheme: dark ? 'dark' : 'light' }}
      className={cn(
        'block min-h-[32rem] w-full border-0 bg-transparent',
        className,
      )}
    />
  );
}
