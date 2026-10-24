import {
  cloneElement,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
  useId,
  useState,
} from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';

const owners = [
  'a[href]',
  'button',
  'summary',
  '[role="button"]',
  '[role="link"]',
  '[role="tab"]',
  '[role="option"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role^="menuitem"]',
  '[tabindex]:not([tabindex="-1"])',
  '[data-truncated]',
].join(', ');

type Label = HTMLAttributes<HTMLElement> & {
  'data-truncated'?: string;
  'data-clipped'?: '' | undefined;
};

function isClipped(element: Element, lines: 1 | 3) {
  return lines === 3
    ? element.scrollHeight > element.clientHeight
    : element.scrollWidth > element.clientWidth;
}

export function TruncatedText({
  text,
  children,
  className,
  render,
  renderTrigger,
  propagateEscape = false,
  lines = 1,
  disclose = 'clipped',
}: {
  text: string;
  children?: ReactNode;
  className?: string;
  render?: ReactElement<HTMLAttributes<HTMLElement>>;
  propagateEscape?: boolean;
  lines?: 1 | 3;
  disclose?: 'clipped' | 'always';
  renderTrigger?: (
    label: ReactElement,
    clip: (value: string, className?: string) => ReactElement,
  ) => ReactElement<{ children?: ReactNode }>;
}) {
  const id = useId();
  const [clipped, setClipped] = useState(false);
  const [owned, setOwned] = useState(false);
  const [selfOpen, setSelfOpen] = useState(false);
  const [ownerOpen, setOwnerOpen] = useState(false);
  const disclosed = text.trim() !== '' && (clipped || disclose === 'always');
  const triggered = renderTrigger !== undefined;

  function attach(element: HTMLElement | null) {
    if (!element) return;
    const pieces = [
      element,
      ...element.querySelectorAll('[data-truncated]'),
    ].filter((piece) => piece.getAttribute('data-truncated') === id);
    const owner = triggered
      ? null
      : (element.parentElement?.closest<HTMLElement>(owners) ?? null);
    let active = true;
    const measure = () => {
      if (active) setClipped(pieces.some((piece) => isClipped(piece, lines)));
    };
    const show = () => {
      if (
        owner?.matches(':focus-visible') &&
        !owner.hasAttribute('data-clipped') &&
        owner.querySelector('[data-clipped]') === element
      )
        setOwnerOpen(true);
    };
    const hide = () => setOwnerOpen(false);
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !element.hasAttribute('data-popup-open'))
        return;
      setOwnerOpen(false);
      setSelfOpen(false);
      if (!propagateEscape) event.stopPropagation();
    };
    setOwned(owner !== null);
    measure();
    const observer = new ResizeObserver(measure);
    for (const piece of pieces) observer.observe(piece);
    void document.fonts.ready.then(measure);
    owner?.addEventListener('focus', show);
    owner?.addEventListener('blur', hide);
    owner?.addEventListener('keydown', dismiss);
    return () => {
      active = false;
      observer.disconnect();
      owner?.removeEventListener('focus', show);
      owner?.removeEventListener('blur', hide);
      owner?.removeEventListener('keydown', dismiss);
    };
  }

  const standalone = !triggered && !owned;
  const clip = (value: string, styles?: string) => (
    <span className={cn('min-w-0 truncate', styles)} data-truncated={id}>
      {value}
    </span>
  );
  const element: ReactElement<Label> = render ?? <span />;
  const label = cloneElement(
    element,
    {
      tabIndex: standalone && disclosed ? 0 : undefined,
      'aria-label': standalone ? text : undefined,
      'data-truncated': id,
      'data-clipped': !triggered && disclosed ? '' : undefined,
      className: cn(
        'relative min-w-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        lines === 3 ? 'line-clamp-3 whitespace-normal' : 'truncate',
        render?.props.className,
        className,
      ),
    },
    children ?? text,
  );
  const trigger = renderTrigger?.(label, clip) ?? label;
  return (
    <Tooltip
      disabled={!disclosed}
      disableHoverablePopup
      open={disclosed && (selfOpen || ownerOpen)}
      onOpenChange={(open, details) => {
        setSelfOpen(open);
        if (!open) setOwnerOpen(false);
        if (propagateEscape && details.reason === 'escape-key')
          details.allowPropagation();
      }}
    >
      <TooltipTrigger ref={attach} render={trigger}>
        {trigger.props.children}
      </TooltipTrigger>
      <TooltipContent role="tooltip" className="wrap-anywhere">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
