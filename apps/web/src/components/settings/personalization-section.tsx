import { Button } from '@renderer/components/ui/button'
import { compactButtonClass } from '@renderer/lib/controls'
import { copyText } from '@renderer/lib/utils'
import { runUserAction } from '@shared/background'
import { profileLayersInstruction } from '@shared/profile-prompts'
import { TestIds } from '@shared/test-ids'
import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

/** Pins and hides stay manual in the file tree and deliberately do not appear here. */
export function PersonalizationSection({ repoPath }: { repoPath: string }): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  const instruction = profileLayersInstruction(repoPath)
  const copy = (): void =>
    runUserAction(
      async () => {
        await copyText(instruction)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      },
      (): void => {
        toast.error('Could not copy the instruction')
      },
    )

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Story order helps Porcelain present a change in the sequence it travels through this
        repository. Add this instruction to your agent guidance.
      </p>
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-card p-3 font-mono text-xs text-foreground/90">
        {instruction}
      </pre>
      <div>
        <Button
          variant="outline"
          size="sm"
          className={compactButtonClass}
          onClick={copy}
          data-testid={TestIds.personalizationCopyInstruction}
        >
          {copied ? <Check /> : <Copy />}
          {copied ? 'Copied' : 'Copy instruction'}
        </Button>
      </div>
    </div>
  )
}
