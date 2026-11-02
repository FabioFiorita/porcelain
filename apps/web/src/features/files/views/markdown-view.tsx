import { File } from '@pierre/diffs/react';
import { markdownHtml } from './markdown-html';
import { externalLink } from '@porcelain/client/links/rules';
import {
  Children,
  useState,
  type ComponentProps,
  isValidElement,
  type ReactNode,
} from 'react';
import { cn } from '@/shared/lib/utils';
import { createPierreFileOptions } from '@/shared/lib/pierre';
import { useTheme } from '@/features/preferences/index';

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

function CodeBlock(props: ComponentProps<'pre'> & { 'data-lang'?: string }) {
  const { dark } = useTheme();
  const lang = (props['data-lang'] ?? 'text').toLowerCase();
  const contents = textOf(Children.toArray(props.children)).replace(/\n$/, '');
  return (
    <div className="my-3 overflow-hidden rounded-lg border">
      <File
        file={{ name: `snippet.${EXTENSION[lang] ?? 'txt'}`, contents }}
        options={createPierreFileOptions(dark ? 'dark' : 'light', {
          overflow: 'wrap',
        })}
      />
    </div>
  );
}

function MarkdownImage({ src, alt }: ComponentProps<'img'>) {
  const [failedSource, setFailedSource] = useState<string>();
  if (!src || !externalLink(src) || failedSource === src)
    return (
      <span className="inline-block rounded border px-2 py-1 text-caption text-muted-foreground">
        Image unavailable{alt ? `: ${alt}` : ''}
      </span>
    );
  return (
    <img
      src={src}
      alt={alt ?? ''}
      className="my-2 h-auto max-w-full rounded"
      referrerPolicy="no-referrer"
      onError={() => setFailedSource(src)}
    />
  );
}

const components = {
  img: MarkdownImage,
  details: (props: ComponentProps<'details'>) => (
    <details className="my-3 rounded border p-3" {...props} />
  ),
  summary: (props: ComponentProps<'summary'>) => (
    <summary className="cursor-pointer font-medium" {...props} />
  ),
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
  a: (props: ComponentProps<'a'>) => (
    <a
      className="text-foreground underline underline-offset-2"
      target="_blank"
      rel="noreferrer"
      {...props}
    />
  ),
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
      <table className="w-full text-left text-caption" {...props} />
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

export function MarkdownView({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <div className={cn('text-ui text-foreground', className)}>
      {markdownHtml(text, components)}
    </div>
  );
}
