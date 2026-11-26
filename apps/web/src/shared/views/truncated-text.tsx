import {
  cloneElement,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
  type Ref,
  useId,
  useState,
} from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { RenderInto } from '@/components/ui/render-part';
import { cn } from '@/shared/lib/utils';

const owners = [
  'a[href]',
  'button',
  'summary',
  '[role="button"]',
  '[role="link"]:not([aria-disabled="true"])',
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
  ref?: Ref<HTMLElement> | undefined;
  'data-truncated'?: string;
  'data-clipped'?: '' | undefined;
};

type Cut = 'end' | 'start' | { readonly keep: string };

function cutContent(cut: Cut, content: ReactNode) {
  return cut === 'start' ? <bdi dir="ltr">{content}</bdi> : content;
}

function middleParts(value: string, keep: string) {
  return value.endsWith(keep) && keep.length < value.length
    ? { head: value.slice(0, value.length - keep.length), tail: keep }
    : { head: value, tail: '' };
}

function ancestors(element: HTMLElement, count: number) {
  const found: HTMLElement[] = [];
  let next = element.parentElement;
  while (next && found.length < count) {
    found.push(next);
    next = next.parentElement;
  }
  return found;
}

function ellipsisWidth(element: HTMLElement) {
  const context = document.createElement('canvas').getContext('2d');
  if (!context) return 0;
  context.font = getComputedStyle(element).font;
  return context.measureText('…').width;
}

function fitMiddleHead(head: HTMLElement) {
  head.style.maxWidth = '';
  const text = head.firstChild;
  if (!(text instanceof Text) || head.scrollWidth <= head.clientWidth) return;
  const room = head.getBoundingClientRect().width;
  const dots = ellipsisWidth(head);
  const range = document.createRange();
  const width = (end: number) => {
    range.setStart(text, 0);
    range.setEnd(text, end);
    return range.getBoundingClientRect().width;
  };
  let low = 0;
  let high = text.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (width(middle) + dots <= room) low = middle;
    else high = middle - 1;
  }
  head.style.maxWidth = `${Math.ceil(width(low) + dots)}px`;
}

function isClipped(element: HTMLElement, lines: 1 | 3) {
  if (lines === 1) return element.scrollWidth > element.clientWidth;
  const height = element.clientHeight;
  const clamp = element.style.webkitLineClamp;
  try {
    element.style.webkitLineClamp = 'unset';
    return element.clientHeight > height;
  } finally {
    element.style.webkitLineClamp = clamp;
  }
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
  cut = 'end',
}: {
  text: string;
  children?: ReactNode;
  className?: string;
  render?: ReactElement<HTMLAttributes<HTMLElement>>;
  propagateEscape?: boolean;
  lines?: 1 | 3;
  disclose?: 'clipped' | 'always';
  cut?: Cut;
  renderTrigger?: (
    label: ReactElement,
    clip: (value: string, className?: string, cut?: Cut) => ReactElement,
  ) => ReactElement<{
    children?: ReactNode;
    ref?: Ref<HTMLElement> | undefined;
  }>;
}) {
  const id = useId();
  const [clipped, setClipped] = useState(false);
  const [owned, setOwned] = useState(false);
  const [selfOpen, setSelfOpen] = useState(false);
  const [ownerOpen, setOwnerOpen] = useState(false);
  const disclosed = text.trim() !== '' && (clipped || disclose === 'always');
  const triggered = renderTrigger !== undefined;

  const [attach] = useState(() => (element: HTMLElement | null) => {
    if (!element) return;
    const pieces = () =>
      [
        element,
        ...element.querySelectorAll<HTMLElement>('[data-truncated]'),
      ].filter((piece) => piece.getAttribute('data-truncated') === id);
    const owner = triggered
      ? null
      : (element.parentElement?.closest<HTMLElement>(owners) ?? null);
    let active = true;
    let frame = 0;
    const measure = () => {
      if (!active) return;
      setClipped(pieces().some((piece) => isClipped(piece, lines)));
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        for (const head of element.querySelectorAll<HTMLElement>(
          '[data-middle-head]',
        ))
          fitMiddleHead(head);
      });
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
      if (event.key !== 'Escape' || !element.hasAttribute('data-open')) return;
      setOwnerOpen(false);
      setSelfOpen(false);
      if (!propagateEscape) event.stopPropagation();
    };
    setOwned(owner !== null);
    measure();
    const observer = new ResizeObserver(measure);
    for (const piece of pieces()) observer.observe(piece);
    for (const head of element.querySelectorAll<HTMLElement>(
      '[data-middle-head]',
    ))
      for (const frame of ancestors(head, 4)) observer.observe(frame);
    const content = new MutationObserver(measure);
    content.observe(element, {
      characterData: true,
      childList: true,
      subtree: true,
    });
    void document.fonts.ready.then(measure);
    owner?.addEventListener('focus', show);
    owner?.addEventListener('blur', hide);
    owner?.addEventListener('keydown', dismiss);
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      content.disconnect();
      owner?.removeEventListener('focus', show);
      owner?.removeEventListener('blur', hide);
      owner?.removeEventListener('keydown', dismiss);
    };
  });

  const standalone = !triggered && !owned;
  const clip = (value: string, styles?: string, edge: Cut = 'end') =>
    typeof edge === 'object' ? (
      <span className={cn('flex min-w-0', styles)}>
        <span
          className="min-w-0 truncate"
          data-truncated={id}
          data-middle-head=""
        >
          {middleParts(value, edge.keep).head}
        </span>
        <span className="shrink-0 whitespace-pre">
          {middleParts(value, edge.keep).tail}
        </span>
      </span>
    ) : (
      <span
        dir={edge === 'start' ? 'rtl' : undefined}
        className={cn(
          'min-w-0 truncate',
          edge === 'start' && 'text-left',
          styles,
        )}
        data-truncated={id}
      >
        {cutContent(edge, value)}
      </span>
    );
  const element: ReactElement<Label> = render ?? <span />;
  const labelId = element.props.id ?? id;
  const label = cloneElement(
    element,
    {
      tabIndex: standalone && disclosed ? 0 : undefined,
      dir: cut === 'start' ? 'rtl' : undefined,
      'aria-label': standalone ? text : undefined,
      id: owned ? labelId : element.props.id,
      'aria-labelledby': owned ? labelId : undefined,
      'data-truncated': id,
      'data-clipped': !triggered && disclosed ? '' : undefined,
      className: cn(
        'relative min-w-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        typeof cut === 'object' && 'flex',
        typeof cut !== 'object' &&
          (lines === 3 ? 'line-clamp-3 whitespace-normal' : 'truncate'),
        cut === 'start' && 'text-left',
        render?.props.className,
        className,
      ),
    },
    typeof cut === 'object'
      ? clip(text, undefined, cut)
      : cutContent(cut, children ?? text),
  );
  const trigger = renderTrigger?.(label, clip) ?? label;
  if (!disclosed && !triggered)
    return <RenderInto ref={attach} render={trigger} />;
  return (
    <Tooltip
      disabled={!disclosed}
      hoverable={false}
      open={disclosed && (selfOpen || ownerOpen)}
      onOpenChange={(open) => {
        setSelfOpen(open);
        if (!open) setOwnerOpen(false);
      }}
    >
      <TooltipTrigger
        ref={attach}
        render={trigger}
        onPointerLeave={() => setSelfOpen(false)}
      >
        {trigger.props.children}
      </TooltipTrigger>
      <TooltipContent role="tooltip" className="wrap-anywhere">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
