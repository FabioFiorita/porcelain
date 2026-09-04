import type { ReviewComment } from '@porcelain/contracts/review'
import { commentRowClass, LineDecorations } from '@renderer/components/git/comment-marker'
import { MarkdownPre } from '@renderer/components/viewer/markdown-code-block'
import { cn } from '@renderer/lib/utils'
import { createElement } from 'react'
import Markdown, { type ExtraProps } from 'react-markdown'
import remarkGfm from 'remark-gfm'

const MARKDOWN_EXTENSIONS = ['md', 'mdx', 'markdown']

export function isMarkdownPath(path: string): boolean {
  const ext = path.split('.').at(-1)?.toLowerCase() ?? ''
  return MARKDOWN_EXTENSIONS.includes(ext)
}

/** Rendered (reader) view for markdown files. Links open in the default browser. */
export function MarkdownView({
  content,
  className,
  compact = false,
  commentsByLine,
  assetBaseUrl,
}: {
  content: string
  className?: string
  compact?: boolean
  commentsByLine?: Map<number, ReviewComment[]>
  /** Token-scoped Canvas attachment root. Relative image paths stay inert when omitted. */
  assetBaseUrl?: string | null
}): React.JSX.Element {
  const sourceProps = (node: ExtraProps['node']): Record<string, number> => {
    const start = node?.position?.start.line
    const end = node?.position?.end.line
    return start === undefined
      ? {}
      : { 'data-source-start-line': start, 'data-source-end-line': end ?? start }
  }
  const commentsFor = (node: ExtraProps['node']): ReviewComment[] => {
    const start = node?.position?.start.line
    const end = node?.position?.end.line ?? start
    if (start === undefined || end === undefined || commentsByLine === undefined) return []
    const found = new Map<string, ReviewComment>()
    for (let line = start; line <= end; line++) {
      for (const comment of commentsByLine.get(line) ?? []) found.set(comment.id, comment)
    }
    return [...found.values()]
  }
  const block =
    (Tag: 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'li' | 'blockquote') =>
    ({
      node,
      className: elementClass,
      children,
      ...props
    }: React.HTMLAttributes<HTMLElement> & ExtraProps) => {
      const comments = commentsFor(node)
      return createElement(
        Tag,
        {
          ...props,
          ...sourceProps(node),
          className: cn(elementClass, 'relative', commentRowClass(comments)),
        },
        <LineDecorations comments={comments} />,
        children,
      )
    }
  return (
    <div className={className ?? 'h-full overflow-y-auto'}>
      <article
        className={
          compact
            ? 'prose prose-sm dark:prose-invert max-w-none px-3 py-2 prose-code:before:content-none prose-code:after:content-none'
            : 'prose prose-sm dark:prose-invert max-w-3xl px-6 py-4 prose-code:before:content-none prose-code:after:content-none'
        }
      >
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{
            // window.open routes through main's setWindowOpenHandler → shell.openExternal
            a: ({
              node,
              ...props
            }: React.JSX.IntrinsicElements['a'] & ExtraProps): React.JSX.Element => (
              <a {...props} {...sourceProps(node)} target="_blank" rel="noreferrer" />
            ),
            img: ({ node, src, alt, ...props }) => {
              const resolved =
                assetBaseUrl !== null &&
                assetBaseUrl !== undefined &&
                src !== undefined &&
                !/^(?:data:|https?:|\/\/|#)/i.test(src)
                  ? `${assetBaseUrl}/${src.split('/').map(encodeURIComponent).join('/')}`
                  : src
              return <img {...props} {...sourceProps(node)} src={resolved} alt={alt ?? ''} />
            },
            p: block('p'),
            h1: block('h1'),
            h2: block('h2'),
            h3: block('h3'),
            h4: block('h4'),
            h5: block('h5'),
            h6: block('h6'),
            li: block('li'),
            blockquote: block('blockquote'),
            pre: ({ node, ...props }) => (
              <div {...sourceProps(node)} className="relative">
                <LineDecorations comments={commentsFor(node)} />
                <MarkdownPre node={node} {...props} />
              </div>
            ),
          }}
        >
          {content}
        </Markdown>
      </article>
    </div>
  )
}
