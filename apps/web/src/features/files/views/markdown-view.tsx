import { File } from '@pierre/diffs/react';
import { EXTENSION_TO_FILE_FORMAT } from '@pierre/diffs';
import { Cause, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import {
  CheckIcon,
  CopyIcon,
  InfoIcon,
  LightbulbIcon,
  MessageSquareWarningIcon,
  OctagonAlertIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from 'lucide-react';
import {
  Children,
  createElement,
  isValidElement,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import type { FilesScope } from '@porcelain/client/files/rules';
import type { RepositoryReference } from '@porcelain/client/links/rules';
import { fileErrorMessage } from '@porcelain/client/files/rules';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import { createPierreFileOptions } from '@/shared/lib/pierre';
import { copyText } from '@/shared/workspace/copy';
import { type Connection } from '@/shared/workspace/connection';
import { useTheme } from '@/features/preferences/index';
import { usePreviewAsset } from '../queries/preview-assets';
import { assetUrl } from '../rules/html-assets';
import { fragmentId } from '../rules/markdown-element';
import type { MarkdownDocument } from '@tanstack/markdown';
import { markdownHtml, type MarkdownElementNode } from './markdown-html';

export type MarkdownFile = {
  path: string;
  scope: FilesScope;
  connection: Connection;
  openPath: (path: string, hash: string) => void;
};

type Variant = 'compact' | 'reader';

const LANGUAGES = new Set<string>(
  Object.values(EXTENSION_TO_FILE_FORMAT).filter(
    (language) => language !== undefined,
  ),
);

function highlightLanguage(language: string): string {
  if (LANGUAGES.has(language)) return language;
  return EXTENSION_TO_FILE_FORMAT[language] ?? 'text';
}

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement<{ children?: ReactNode }>(node))
    return textOf(node.props.children);
  return '';
}

function CodeBlock({
  language,
  children,
}: {
  language: string;
  children: ReactNode;
}) {
  const { dark } = useTheme();
  const contents = textOf(Children.toArray(children)).replace(/\n$/, '');
  const lang = highlightLanguage(language);
  return (
    <figure className="group/code my-4 min-w-0 overflow-hidden rounded-lg border bg-card">
      <figcaption className="flex h-8 items-center justify-between gap-2 border-b bg-muted/50 pr-1 pl-3 font-mono text-2xs text-muted-foreground">
        <span className="whitespace-nowrap">
          {language}
          {language === 'mermaid' && (
            <span className="font-sans"> · diagram shown as source</span>
          )}
        </span>
        <CopyCode text={contents} />
      </figcaption>
      <File
        file={{ name: 'snippet', contents, lang }}
        options={{
          ...codeBlockOptions(dark),
          disableLineNumbers: true,
        }}
      />
    </figure>
  );
}

function codeBlockOptions(dark: boolean) {
  const options = createPierreFileOptions(dark ? 'dark' : 'light', {
    overflow: 'scroll',
  });
  return {
    ...options,
    unsafeCSS: `${options.unsafeCSS ?? ''}
[data-code] [data-line] { padding-inline: calc(var(--spacing) * 3); }`,
  };
}

function CopyCode({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Copy code"
            onClick={() => {
              copyText(text, 'code');
              setCopied(true);
            }}
            onMouseLeave={() => setCopied(false)}
          />
        }
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </TooltipTrigger>
      <TooltipContent role="tooltip">Copy code</TooltipContent>
    </Tooltip>
  );
}

const ALERTS: Record<
  string,
  { label: string; icon: LucideIcon; tone: string }
> = {
  'alert-note': {
    label: 'Note',
    icon: InfoIcon,
    tone: 'border-graph-1 [--alert:var(--graph-1)]',
  },
  'alert-tip': {
    label: 'Tip',
    icon: LightbulbIcon,
    tone: 'border-graph-2 [--alert:var(--graph-2)]',
  },
  'alert-important': {
    label: 'Important',
    icon: MessageSquareWarningIcon,
    tone: 'border-graph-3 [--alert:var(--graph-3)]',
  },
  'alert-warning': {
    label: 'Warning',
    icon: TriangleAlertIcon,
    tone: 'border-graph-4 [--alert:var(--graph-4)]',
  },
  'alert-caution': {
    label: 'Caution',
    icon: OctagonAlertIcon,
    tone: 'border-del-fg [--alert:var(--del-fg)]',
  },
};

function Alert({ role, children }: { role: string; children: ReactNode[] }) {
  const alert = ALERTS[role];
  if (!alert) return <div>{children}</div>;
  const Icon = alert.icon;
  const [, ...body] = children;
  return (
    <div
      role="note"
      aria-label={alert.label}
      className={cn(
        'my-4 border-l-3 py-0.5 pl-4 [&>div>:first-child]:mt-0 [&>div>:last-child]:mb-0',
        alert.tone,
      )}
    >
      <p className="mb-1 flex items-center gap-1.5 font-medium text-(--alert)">
        <Icon className="size-4" aria-hidden />
        {alert.label}
      </p>
      {body}
    </div>
  );
}

function Unavailable({ alt, reason }: { alt: string; reason: string }) {
  return (
    <span
      role="img"
      aria-label={alt || reason}
      className="inline-flex max-w-full items-center gap-1 rounded border border-dashed px-2 py-0.5 align-middle text-caption text-muted-foreground"
    >
      <span className="wrap-anywhere">
        {alt ? `${alt} · ${reason}` : reason}
      </span>
    </span>
  );
}

function useSource(
  file: MarkdownFile | undefined,
  source: RepositoryReference | undefined,
):
  | { kind: 'ready'; url: string }
  | { kind: 'loading' }
  | { kind: 'failed'; reason: string } {
  const repository =
    file && source?.kind === 'repository' ? source.path : undefined;
  const asset = usePreviewAsset(
    file?.connection ?? null,
    file?.scope ?? { projectId: '', worktreeId: '' },
    file?.path ?? '',
    repository,
  );
  if (source?.kind === 'external') return { kind: 'ready', url: source.url };
  if (repository === undefined || asset === undefined)
    return {
      kind: 'failed',
      reason: source?.kind === 'repository' ? 'not in this view' : 'blocked',
    };
  if (AsyncResult.isInitial(asset)) return { kind: 'loading' };
  if (AsyncResult.isFailure(asset))
    return {
      kind: 'failed',
      reason: fileErrorMessage(Cause.squash(asset.cause)),
    };
  const answer = Option.getOrThrow(AsyncResult.value(asset));
  return answer === null
    ? { kind: 'failed', reason: 'not found or not previewable' }
    : { kind: 'ready', url: assetUrl(answer) };
}

function MarkdownImage({
  element,
  file,
}: {
  element: MarkdownElementNode;
  file: MarkdownFile | undefined;
}) {
  const source = useSource(file, element.source);
  const [failed, setFailed] = useState<string>();
  const alt = typeof element.props.alt === 'string' ? element.props.alt : '';
  if (source.kind === 'failed')
    return <Unavailable alt={alt} reason={source.reason} />;
  if (source.kind === 'loading')
    return (
      <span
        aria-busy
        aria-label={alt || 'Loading image'}
        className="inline-block h-6 w-24 animate-pulse rounded bg-muted align-middle"
      />
    );
  if (failed === source.url) return <Unavailable alt={alt} reason="failed" />;
  return (
    <img
      {...element.props}
      alt={alt}
      src={source.url}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(source.url)}
      className="inline h-auto max-w-full align-middle"
    />
  );
}

function MarkdownSource({
  element,
  file,
}: {
  element: MarkdownElementNode;
  file: MarkdownFile | undefined;
}) {
  const source = useSource(file, element.source);
  if (source.kind !== 'ready') return null;
  const { media, type } = element.props;
  const typed = typeof type === 'string' ? { type } : {};
  return typeof media === 'string' ? (
    <source media={media} srcSet={source.url} {...typed} />
  ) : (
    <source src={source.url} {...typed} />
  );
}

function MarkdownMedia({
  element,
  file,
  children,
}: {
  element: MarkdownElementNode;
  file: MarkdownFile | undefined;
  children: ReactNode[];
}) {
  const direct = element.source?.kind === 'repository';
  const source = useSource(file, direct ? element.source : undefined);
  const poster = useSource(file, element.poster);
  if (direct && source.kind === 'failed')
    return (
      <Unavailable
        alt={element.tag === 'video' ? 'Video' : 'Audio'}
        reason={source.reason}
      />
    );
  if (direct && source.kind === 'loading')
    return (
      <span className="my-3 block aspect-video max-w-120 animate-pulse rounded-lg bg-muted" />
    );
  return createElement(
    element.tag,
    {
      ...element.props,
      ...(direct && source.kind === 'ready' ? { src: source.url } : {}),
      ...(poster.kind === 'ready' ? { poster: poster.url } : {}),
      className:
        element.tag === 'video'
          ? 'my-3 block h-auto max-w-full rounded-lg border bg-black'
          : 'my-3 block w-full max-w-120',
    },
    ...children,
  );
}

function MarkdownLink({
  element,
  file,
  children,
}: {
  element: MarkdownElementNode;
  file: MarkdownFile | undefined;
  children: ReactNode[];
}) {
  const link = element.link;
  const footnote =
    element.role === 'footnote-ref' || element.role === 'footnote-backref';
  const className = footnote
    ? 'text-muted-foreground no-underline hover:text-foreground'
    : 'text-brand underline decoration-brand/40 underline-offset-2 hover:decoration-brand';
  if (link?.kind === 'external')
    return (
      <a
        {...element.props}
        href={link.url}
        target="_blank"
        rel="noreferrer noopener"
        className={className}
      >
        {children}
      </a>
    );
  if (link?.kind === 'fragment')
    return (
      <a
        {...element.props}
        href={link.hash}
        className={className}
        onClick={(event: MouseEvent<HTMLAnchorElement>) => {
          event.preventDefault();
          scrollToFragment(event.currentTarget, link.hash);
        }}
      >
        {children}
      </a>
    );
  if (link?.kind === 'repository' && file) {
    const open = () => file.openPath(link.path, link.hash);
    return (
      <a
        {...element.props}
        role="link"
        tabIndex={0}
        title={link.path}
        className={cn(className, 'cursor-pointer')}
        onClick={(event: MouseEvent<HTMLAnchorElement>) => {
          event.preventDefault();
          open();
        }}
        onKeyDown={(event: KeyboardEvent<HTMLAnchorElement>) => {
          if (event.key === 'Enter') open();
        }}
      >
        {children}
      </a>
    );
  }
  return <span {...element.props}>{children}</span>;
}

export function scrollToFragment(from: Element, hash: string) {
  const root = from.closest('[data-markdown-root]');
  const id = fragmentId(hash);
  if (!root || id === undefined) return;
  const target =
    root.querySelector(`[id="${CSS.escape(id)}"]`) ??
    root.querySelector(`[id="user-content-${CSS.escape(id)}"]`);
  if (!target) return;
  let scroller =
    root.closest<HTMLElement>('[data-reader-scroll]') ?? root.parentElement;
  while (scroller && scroller.scrollHeight <= scroller.clientHeight)
    scroller = scroller.parentElement;
  if (!scroller) return;
  scroller.scrollTop +=
    target.getBoundingClientRect().top -
    scroller.getBoundingClientRect().top -
    SCROLL_MARGIN;
}

const SCROLL_MARGIN = 16;

const COMPACT: Record<string, string> = {
  h1: 'mt-5 mb-2 text-lg font-semibold first:mt-0',
  h2: 'mt-5 mb-2 text-base font-semibold first:mt-0',
  h3: 'mt-4 mb-1.5 text-sm font-semibold',
  h4: 'mt-4 mb-1.5 text-sm font-semibold',
  h5: 'mt-3 mb-1 text-ui font-semibold',
  h6: 'mt-3 mb-1 text-ui font-semibold text-muted-foreground',
  p: 'my-2 leading-relaxed',
  ul: 'my-2 list-disc pl-5',
  ol: 'my-2 list-decimal pl-5',
  li: 'my-0.5',
};

const READER: Record<string, string> = {
  h1: 'mt-8 mb-4 border-b pb-2 text-subpage-title font-semibold first:mt-0',
  h2: 'mt-8 mb-3 border-b pb-1.5 text-lead font-semibold tracking-pr-subheading first:mt-0',
  h3: 'mt-6 mb-2 text-section font-semibold',
  h4: 'mt-5 mb-2 text-prose font-semibold',
  h5: 'mt-5 mb-1.5 text-ui font-semibold',
  h6: 'mt-5 mb-1.5 text-ui font-semibold text-muted-foreground',
  p: 'my-3',
  ul: 'my-3 list-disc pl-6 [&_ul]:my-1 [&_ol]:my-1',
  ol: 'my-3 list-decimal pl-6 [&_ul]:my-1 [&_ol]:my-1',
  li: 'my-1 pl-0.5 marker:text-muted-foreground',
};

const SHARED: Record<string, string> = {
  li: 'has-[>input[type=checkbox]]:list-none has-[>input[type=checkbox]]:-ml-5',
  code: 'rounded-sm bg-muted px-1 py-px font-mono text-[0.875em]',
  kbd: 'rounded border border-b-2 bg-muted px-1.5 py-px font-mono text-[0.8em] text-foreground',
  blockquote:
    'my-4 border-l-3 pl-4 text-muted-foreground [&>:first-child]:mt-0 [&>:last-child]:mb-0 [&>p]:my-2',
  hr: 'my-6 border-t',
  details: 'my-4 rounded-lg border px-3 py-2 open:pb-3',
  summary: 'cursor-pointer font-medium select-none',
  dl: 'my-3',
  dt: 'mt-3 font-semibold',
  dd: 'mt-1 pl-4',
  mark: 'rounded-sm bg-graph-4/20 px-0.5 text-foreground',
  sup: 'text-[0.75em]',
  sub: 'text-[0.75em]',
  figure: 'my-4',
  figcaption: 'mt-1 text-caption text-muted-foreground',
  input: 'mr-1.5 size-3.5 translate-y-0.5 accent-brand',
  thead: '',
  th: 'sticky top-0 z-1 border-b bg-muted px-3 py-1.5 text-left font-medium whitespace-nowrap',
  td: 'max-w-96 border-b px-3 py-1.5 align-top',
  tr: 'last:[&>td]:border-b-0',
  caption: 'px-3 py-1.5 text-left text-caption text-muted-foreground',
};

function renderer(file: MarkdownFile | undefined, variant: Variant) {
  const classes = variant === 'reader' ? READER : COMPACT;
  return (
    element: MarkdownElementNode,
    children: ReactNode[],
    key: number,
  ): ReactNode => {
    if (element.role?.startsWith('alert-') && element.role !== 'alert-title')
      return element.role === 'alert-content' ? (
        <div key={key}>{children}</div>
      ) : (
        <Alert key={key} role={element.role}>
          {children}
        </Alert>
      );
    if (element.role === 'footnotes')
      return (
        <section
          key={key}
          className="mt-8 border-t pt-4 text-ui text-muted-foreground [&_li]:my-1 [&_p]:my-1"
        >
          {children}
        </section>
      );
    switch (element.tag) {
      case 'a':
        return (
          <MarkdownLink key={key} element={element} file={file}>
            {children}
          </MarkdownLink>
        );
      case 'img':
        return <MarkdownImage key={key} element={element} file={file} />;
      case 'source':
        return <MarkdownSource key={key} element={element} file={file} />;
      case 'video':
      case 'audio':
        return (
          <MarkdownMedia key={key} element={element} file={file}>
            {children}
          </MarkdownMedia>
        );
      case 'pre':
        return (
          <CodeBlock key={key} language={element.language ?? 'text'}>
            {children}
          </CodeBlock>
        );
      case 'table':
        return (
          <div
            key={key}
            className="my-4 max-h-144 max-w-full overflow-auto rounded-lg border"
          >
            <table className="w-max min-w-full border-separate border-spacing-0 text-ui">
              {children}
            </table>
          </div>
        );
    }
    return createElement(
      element.tag,
      {
        key,
        ...element.props,
        className: cn(
          classes[element.tag] ?? SHARED[element.tag],
          classes[element.tag] && SHARED[element.tag],
          element.props.className === 'sr-only' && 'sr-only',
        ),
      },
      ...children,
    );
  };
}

export function MarkdownView({
  text,
  className,
  file,
  variant = 'compact',
}: {
  text: string | MarkdownDocument;
  className?: string;
  file?: MarkdownFile | undefined;
  variant?: Variant;
}) {
  return (
    <div
      data-markdown-root
      className={cn(
        'min-w-0 text-foreground',
        variant === 'reader' ? 'text-prose break-words' : 'text-ui',
        className,
      )}
    >
      {markdownHtml(text, file?.path ?? '', renderer(file, variant))}
    </div>
  );
}
