import { Button } from '@renderer/components/ui/button'
import { CodeLine, useTokenizedLines } from '@renderer/components/viewer/code-line'
import { toastUserActionError } from '@renderer/hooks/mutation-error'
import { fenceLanguageFor } from '@renderer/lib/highlight'
import { copyText } from '@renderer/lib/utils'
import { runUserAction } from '@shared/background'
import { Check, Copy } from 'lucide-react'
import { Children, isValidElement, type ReactNode, useState } from 'react'
import type { ExtraProps } from 'react-markdown'

function nodeToPlainText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(nodeToPlainText).join('')
  if (isValidElement<{ children?: ReactNode }>(node)) return nodeToPlainText(node.props.children)
  return ''
}

/** A fenced block renders as `<pre><code class="language-x">…</code></pre>` with
 * nothing else inside — anything else (rehype-injected wrappers, multiple children)
 * falls back to the plain `<pre>` so we never misrender an unfamiliar shape. */
function extractCodeBlock(
  children: ReactNode,
): { className: string | undefined; code: string } | null {
  const childNodes = Children.toArray(children)
  if (childNodes.length !== 1) return null
  const onlyChild = childNodes[0]
  if (!isValidElement<{ className?: string; children?: ReactNode }>(onlyChild)) return null
  if (onlyChild.type !== 'code') return null
  return { className: onlyChild.props.className, code: nodeToPlainText(onlyChild.props.children) }
}

const FENCE_LANGUAGE_CLASS_REGEX = /(?:^|\s)language-(\S+)/

function extractFenceLanguage(className: string | undefined): string | null {
  return className?.match(FENCE_LANGUAGE_CLASS_REGEX)?.[1] ?? null
}

/**
 * Fenced code block for rendered markdown (skills, results docs, review prose):
 * a header (language + copy) over Shiki-highlighted lines, the same tokenizer the
 * diff and file viewers use. Replaces Tailwind Typography's default `pre`/`code`
 * styling, whose light-on-dark palette went unreadable once `prose-pre:bg-muted/40`
 * swapped the background light without touching the (still light) text color.
 */
function MarkdownCodeBlock({
  code,
  language,
}: {
  code: string
  language: string | null
}): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  const trimmedCode = code.replace(/\n$/, '')
  const lines = trimmedCode.split('\n')
  const tokenLines = useTokenizedLines(trimmedCode, fenceLanguageFor(language))

  const handleCopy = async (): Promise<void> => {
    await copyText(trimmedCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="not-prose overflow-hidden rounded-lg border border-border bg-muted/40">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
        <span className="truncate font-mono text-2xs text-muted-foreground">
          {language ?? 'text'}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => {
            runUserAction(
              () => handleCopy(),
              (error) => {
                toastUserActionError('Copy code', error)
              },
            )
          }}
          aria-label={copied ? 'Copied' : 'Copy code'}
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
        </Button>
      </div>
      <div className="overflow-x-auto px-3 py-2.5">
        <code className="grid font-mono text-xs-minus leading-relaxed text-foreground/90">
          {lines.map((line, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: lines are static per code block
            <CodeLine key={i} tokens={tokenLines?.[i] ?? null} text={line} />
          ))}
        </code>
      </div>
    </div>
  )
}

/** `pre` component override for react-markdown: routes fenced code through
 * `MarkdownCodeBlock`, falls back to a plain `<pre>` for anything else. */
export function MarkdownPre({
  node: _node,
  children,
  ...props
}: React.JSX.IntrinsicElements['pre'] & ExtraProps): React.JSX.Element {
  const codeBlock = extractCodeBlock(children)
  if (!codeBlock) return <pre {...props}>{children}</pre>
  return (
    <MarkdownCodeBlock code={codeBlock.code} language={extractFenceLanguage(codeBlock.className)} />
  )
}
