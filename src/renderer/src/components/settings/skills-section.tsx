import { Button } from '@renderer/components/ui/button'
import { useSkillsInfo } from '@renderer/hooks/use-skills'
import { copyText } from '@renderer/lib/utils'
import { Check, Copy } from 'lucide-react'
import { useState } from 'react'

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
      <div className="min-w-0">
        <h4 className="text-sm-minus font-semibold">Install skills</h4>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Porcelain's companion skills are distributed via{' '}
          <a
            href="https://www.skills.sh"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            skills.sh
          </a>
          . Run the command below from any repo (choose global or project-local when prompted).
          {info?.version ? ` Current bundle: v${info.version}.` : ''}
        </p>
      </div>

      <div className="min-w-0">
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Add skills
          </p>
          <Button
            variant="ghost"
            size="sm"
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
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Upgrade skills
          </p>
          <Button
            variant="ghost"
            size="sm"
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
