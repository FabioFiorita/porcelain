import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Textarea } from '@renderer/components/ui/textarea'
import { useChatActions } from '@renderer/hooks/use-chat'
import { compactButtonClass } from '@renderer/lib/controls'
import { kbdLabel } from '@renderer/lib/keyboard'
import { cn } from '@renderer/lib/utils'
import { useState } from 'react'

/**
 * Compact post form for the human. Default `from` is "you" so agent labels stay
 * distinct; agents set their own label via the porcelain CLI.
 */
export function ChatComposer(): React.JSX.Element {
  const { post } = useChatActions()
  const [from, setFrom] = useState('you')
  const [body, setBody] = useState('')
  const [pending, setPending] = useState(false)

  const send = async (): Promise<void> => {
    const f = from.trim()
    const b = body.trim()
    if (f === '' || b === '' || pending) return
    setPending(true)
    try {
      await post(f, b)
      setBody('')
    } finally {
      setPending(false)
    }
  }

  const onKeyDown = async (e: React.KeyboardEvent): Promise<void> => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      await send()
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Input
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="From (e.g. you, local)"
        aria-label="Message from"
        className="h-8 text-xs"
      />
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={`Message — ${kbdLabel('mod', '↵')} to send`}
        aria-label="Message body"
        rows={2}
        className="max-h-32 min-h-14 resize-none overflow-y-auto text-xs"
      />
      <Button
        size="sm"
        className={cn(compactButtonClass, 'self-end')}
        disabled={from.trim() === '' || body.trim() === '' || pending}
        onClick={send}
      >
        {pending ? 'Sending…' : 'Send'}
      </Button>
    </div>
  )
}
