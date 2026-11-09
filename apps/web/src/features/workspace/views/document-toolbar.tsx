import { TruncatedText } from '@/shared/views/truncated-text';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/shared/lib/utils';

export function DocumentToolbar({
  target,
  barActions,
  title,
  titleLabel,
  subtitle,
  children,
  className,
}: {
  target?: HTMLElement | null | undefined;
  barActions?: ReactNode;
  subtitle?: string;
  children?: ReactNode;
  className?: string;
} & (
  | { title: string; titleLabel?: string }
  | { title: ReactNode; titleLabel: string }
)) {
  if (target !== undefined)
    return (
      <>
        {target &&
          createPortal(
            barActions === undefined ? children : barActions,
            target,
          )}
        <div className="shrink-0 px-3.5 py-2">
          <TruncatedText
            text={titleLabel ?? (typeof title === 'string' ? title : '')}
            render={<h1 />}
            className="text-ui font-semibold"
          >
            {title}
          </TruncatedText>
          {subtitle && (
            <p className="text-2xs text-muted-foreground">{subtitle}</p>
          )}
          {barActions !== undefined && (
            <div className="flex flex-wrap items-center gap-1.5">
              {children}
            </div>
          )}
        </div>
      </>
    );
  return (
    <header
      data-testid="document-toolbar"
      className={cn(
        'flex min-h-11 shrink-0 flex-wrap items-center gap-x-2.5 gap-y-1 border-b px-3.5',
        className,
      )}
    >
      <div className="flex min-w-0 flex-auto flex-col">
        <TruncatedText
          text={titleLabel ?? (typeof title === 'string' ? title : '')}
          render={<h1 />}
          className="text-ui leading-tight font-semibold"
        >
          {title}
        </TruncatedText>
        {subtitle !== null && subtitle !== undefined && (
          <TruncatedText
            text={subtitle}
            render={<p />}
            className="text-2xs leading-tight text-muted-foreground"
          />
        )}
      </div>
      <div className="ml-auto flex max-w-full shrink-0 flex-wrap items-center justify-end gap-1.5">
        {children}
      </div>
    </header>
  );
}
