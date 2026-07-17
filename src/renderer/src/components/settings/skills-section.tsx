import { Button } from '@renderer/components/ui/button'
import { useSkillsInfo } from '@renderer/hooks/use-skills'
import { compactButtonClass } from '@renderer/lib/controls'
import { copyText } from '@renderer/lib/utils'
import { Check, Copy } from 'lucide-react'
import { useState } from 'react'

/**
 * Command blocks only — the parent Agents "Skills" group owns the section title
 * and blurb so this doesn't re-introduce the same-weight heading underneath.
 */
export function SkillsSection(): React.JSX.Element {
  const info = useSkillsInfo()
  const [copiedInstall, setCopiedInstall] = useState(false)
  const [copiedUpgrade, setCopiedUpgrade] = useState(false)

  const installCommand = info?.installCommand ?? ''
  const upgradeCommand = info?.upgradeCommand ?? ''

  const copy = async (text: string, setCopied: (value: boolean) => void): Promise<void> => {
    await copyText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {info?.version != null && (
        <p className="text-xs text-muted-foreground">Current bundle: v{info.version}.</p>
      )}

      <div className="min-w-0">
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-2xs font-medium tracking-wider text-muted-foreground uppercase">
            Add skills
          </p>
          <Button
            variant="ghost"
            size="sm"
            className={compactButtonClass}
            onClick={() => copy(installCommand, setCopiedInstall)}
            disabled={installCommand.length === 0}
          >
            {copiedInstall ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copiedInstall ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <pre className="max-w-full overflow-auto rounded-md bg-card p-2.5 font-mono text-xs-minus text-foreground/90">
          {installCommand}
        </pre>
      </div>

      <div className="min-w-0">
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-2xs font-medium tracking-wider text-muted-foreground uppercase">
            Upgrade skills
          </p>
          <Button
            variant="ghost"
            size="sm"
            className={compactButtonClass}
            onClick={() => copy(upgradeCommand, setCopiedUpgrade)}
            disabled={upgradeCommand.length === 0}
          >
            {copiedUpgrade ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copiedUpgrade ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <pre className="max-w-full overflow-auto rounded-md bg-card p-2.5 font-mono text-xs-minus text-foreground/90">
          {upgradeCommand}
        </pre>
      </div>
    </div>
  )
}
