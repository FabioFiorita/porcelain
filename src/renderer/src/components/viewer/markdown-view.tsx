import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const MARKDOWN_EXTENSIONS = ['md', 'mdx', 'markdown']

export function isMarkdownPath(path: string): boolean {
  const ext = path.split('.').at(-1)?.toLowerCase() ?? ''
  return MARKDOWN_EXTENSIONS.includes(ext)
}

/** Rendered (reader) view for markdown files. Links open in the default browser. */
export function MarkdownView({ content }: { content: string }): React.JSX.Element {
  return (
    <div className="h-full overflow-y-auto">
      <article className="prose prose-sm prose-invert max-w-3xl px-6 py-4 prose-pre:bg-muted/40 prose-code:before:content-none prose-code:after:content-none">
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{
            // window.open routes through main's setWindowOpenHandler → shell.openExternal
            a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
          }}
        >
          {content}
        </Markdown>
      </article>
    </div>
  )
}
