import { File } from '@pierre/diffs/react';
import { Markdown } from '@tanstack/markdown/react';
import {
  Children,
  Component,
  type ComponentProps,
  isValidElement,
  type ReactNode,
  Suspense,
  useMemo,
  useState,
} from 'react';
import { cn } from '@/lib/utils';
import { resolveRelativePath } from '../../domain/files';
import type { ReviewScope } from '../../domain/review';
import { usePreviewLink } from '../../query/files';
import { usePreferences } from '../workspace/preferences';
import { PIERRE_THEME } from './pierre';

const EXTENSION: Record<string, string> = {
  ts: 'ts',
  typescript: 'ts',
  tsx: 'tsx',
  js: 'js',
  javascript: 'js',
  jsx: 'jsx',
  json: 'json',
  bash: 'sh',
  sh: 'sh',
  shell: 'sh',
  css: 'css',
  html: 'html',
  md: 'md',
  markdown: 'md',
  yaml: 'yaml',
  yml: 'yaml',
  sql: 'sql',
  diff: 'diff',
};

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement<{ children?: ReactNode }>(node))
    return textOf(node.props.children);
  return '';
}

/**
 * Fenced code goes through Pierre, so markdown and diffs share one highlighter
 * and tokens render as text; TanStack Markdown's HTML highlighter hook is unused.
 */
function CodeBlock(props: ComponentProps<'pre'> & { 'data-lang'?: string }) {
  const { resolvedTheme } = usePreferences();
  const lang = (props['data-lang'] ?? 'text').toLowerCase();
  const contents = textOf(Children.toArray(props.children)).replace(/\n$/, '');
  return (
    <div className="my-3 overflow-hidden rounded-lg border">
      <File
        file={{ name: `snippet.${EXTENSION[lang] ?? 'txt'}`, contents }}
        options={{
          theme: PIERRE_THEME,
          themeType: resolvedTheme,
          disableFileHeader: true,
          overflow: 'wrap',
        }}
      />
    </div>
  );
}

/** Only web, mail and in-page links; anything else (`javascript:`, `data:`) renders as text. */
const SAFE_HREF = /^(?:https?:|mailto:|#)/i;

function SafeLink({ href, children, ...props }: ComponentProps<'a'>) {
  if (href == null || !SAFE_HREF.test(href)) return <span>{children}</span>;
  return (
    <a
      className="text-foreground underline underline-offset-2"
      target="_blank"
      rel="noreferrer noopener"
      href={href}
      {...props}
    >
      {children}
    </a>
  );
}

const imageLabel = (alt: string | undefined) =>
  alt == null || alt === '' ? 'image' : alt;

/** Images are not loaded (a comment could track who reads it); the alt text links to them instead. */
function ImageLink({ src, alt }: ComponentProps<'img'>) {
  const label = imageLabel(alt);
  return typeof src === 'string' && SAFE_HREF.test(src) ? (
    <SafeLink href={src}>[{label}]</SafeLink>
  ) : (
    <span>[{label}]</span>
  );
}

const IMAGE_CLASS = 'my-2 inline-block max-w-full rounded-md';

/** A missing file or a failed read shows the alt text, not an error panel in the middle of prose. */
class ImageFallback extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function RepositoryImage({
  scope,
  path,
  alt,
}: {
  scope: ReviewScope;
  path: string;
  alt?: string;
}) {
  const { url } = usePreviewLink(scope, path);
  const [broken, setBroken] = useState(false);
  if (broken) return <span>[{imageLabel(alt)}]</span>;
  return (
    <img
      src={url}
      alt={alt ?? ''}
      title={path}
      onError={() => setBroken(true)}
      className={IMAGE_CLASS}
    />
  );
}

/**
 * In the Reader, a Markdown file's images show: web images load directly, and a
 * path in the repository loads from its preview link. Anything else keeps its alt text.
 */
function ReaderImage({
  src,
  alt,
  scope,
  file,
}: ComponentProps<'img'> & { scope: ReviewScope; file: string }) {
  const label = <span>[{imageLabel(alt)}]</span>;
  if (typeof src !== 'string') return label;
  if (/^https?:/i.test(src))
    return (
      <img
        src={src}
        alt={alt ?? ''}
        referrerPolicy="no-referrer"
        loading="lazy"
        className={IMAGE_CLASS}
      />
    );
  const path = resolveRelativePath(file, src);
  if (path == null) return label;
  return (
    <ImageFallback fallback={label}>
      <Suspense
        fallback={
          <span className="inline-block h-24 w-40 animate-pulse rounded-md bg-muted" />
        }
      >
        <RepositoryImage scope={scope} path={path} alt={alt} />
      </Suspense>
    </ImageFallback>
  );
}

const components = {
  pre: CodeBlock,
  h1: (props: ComponentProps<'h1'>) => (
    <h1 className="mt-5 mb-2 text-lg font-semibold first:mt-0" {...props} />
  ),
  h2: (props: ComponentProps<'h2'>) => (
    <h2 className="mt-5 mb-2 text-base font-semibold first:mt-0" {...props} />
  ),
  h3: (props: ComponentProps<'h3'>) => (
    <h3 className="mt-4 mb-1.5 text-sm font-semibold" {...props} />
  ),
  p: (props: ComponentProps<'p'>) => (
    <p className="my-2 leading-relaxed" {...props} />
  ),
  ul: (props: ComponentProps<'ul'>) => (
    <ul className="my-2 list-disc pl-5" {...props} />
  ),
  ol: (props: ComponentProps<'ol'>) => (
    <ol className="my-2 list-decimal pl-5" {...props} />
  ),
  li: (props: ComponentProps<'li'>) => <li className="my-0.5" {...props} />,
  a: SafeLink,
  img: ImageLink,
  code: (props: ComponentProps<'code'>) => (
    <code
      className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]"
      {...props}
    />
  ),
  blockquote: (props: ComponentProps<'blockquote'>) => (
    <blockquote
      className="my-3 border-l-2 pl-3 text-muted-foreground"
      {...props}
    />
  ),
  table: (props: ComponentProps<'table'>) => (
    <div className="my-3 overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-[12.5px]" {...props} />
    </div>
  ),
  th: (props: ComponentProps<'th'>) => (
    <th className="border-b bg-muted/60 px-3 py-1.5 font-medium" {...props} />
  ),
  td: (props: ComponentProps<'td'>) => (
    <td className="border-b px-3 py-1.5 last:border-b-0" {...props} />
  ),
  hr: () => <hr className="my-4" />,
};

/**
 * Agent- and reviewer-written Markdown. Raw HTML is never rendered: `allowHtml`
 * stays off, so a `<script>` or `<img onerror>` in a body shows as text. Images
 * only load for a Markdown file read as a document (`images`), never in comments.
 */
export function MarkdownView({
  text,
  className,
  images,
}: {
  text: string;
  className?: string;
  /** The file this Markdown is, so its relative images resolve from its folder. */
  images?: { scope: ReviewScope; path: string };
}) {
  const scope = images?.scope;
  const file = images?.path;
  const shown = useMemo(
    () =>
      scope == null || file == null
        ? components
        : {
            ...components,
            img: (props: ComponentProps<'img'>) => (
              <ReaderImage {...props} scope={scope} file={file} />
            ),
          },
    [scope, file],
  );
  return (
    <div className={cn('text-[13px] text-foreground', className)}>
      <Markdown components={shown} allowHtml={false}>
        {text}
      </Markdown>
    </div>
  );
}
