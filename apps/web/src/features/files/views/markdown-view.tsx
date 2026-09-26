import { File } from '@pierre/diffs/react';
import { Markdown } from '@tanstack/markdown/react';
import {
  Children,
  type ComponentProps,
  isValidElement,
  type ReactNode,
} from 'react';
import { cn } from '@/shared/lib/utils';
import { createPierreFileOptions } from '@/shared/lib/pierre';
import { useTheme } from '@/shared/workspace/theme';

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

export function MarkdownView({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <div className={cn('text-[13px] text-foreground', className)}>
      <Markdown components={components}>{text}</Markdown>
    </div>
  );
}
