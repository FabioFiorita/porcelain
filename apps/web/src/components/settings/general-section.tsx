import type { CommitModel, CommitModelOption } from '@porcelain/contracts'
import { Button } from '@renderer/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@renderer/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { ToggleGroup, ToggleGroupItem } from '@renderer/components/ui/toggle-group'
import { useCommitModels } from '@renderer/features/git'
import { useDaemonIdentity, useEnvironmentName } from '@renderer/hooks/use-daemon-identity'
import { compactButtonClass } from '@renderer/lib/controls'
import { isBrowser } from '@renderer/lib/platform'
import {
  type DiffMode,
  type HtmlMode,
  type MarkdownMode,
  type PullMode,
  type ThemeMode,
  usePreferencesStore,
} from '@renderer/stores/preferences'
import { TestIds } from '@shared/test-ids'
import { Check, ChevronsUpDown } from 'lucide-react'
import { useState } from 'react'

/**
 * Settings type scale (page title lives on the dialog header):
 * - Control label: text-sm-minus font-medium
 * - Nested option: text-xs font-medium
 * - Description: text-xs text-muted-foreground
 */
function PreferenceRow({
  label,
  description,
  children,
}: {
  label: string
  description: string
  children: React.ReactNode
}): React.JSX.Element {
  // Stack on narrow widths so toggle groups never collide with the description
  // (the dual-pane Settings body on iPhone used to leave ~200px for both).
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="text-sm-minus font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0 self-start sm:self-center">{children}</div>
    </div>
  )
}

function CommitModelPicker({
  value,
  onChange,
  options,
  isLoading,
}: {
  value: CommitModel
  onChange: (value: CommitModel) => void
  options: CommitModelOption[]
  isLoading: boolean
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const selected = options.find((option) => option.id === value)

  return (
    <Popover open={open} onOpenChange={(next: boolean): void => setOpen(next)}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className={compactButtonClass}
            disabled={isLoading || options.length === 0}
            aria-label="Commit message model"
            data-testid={TestIds.settingsCommitModel}
          >
            {isLoading ? 'Loading…' : (selected?.label ?? 'No providers')}
            <ChevronsUpDown />
          </Button>
        }
      />
      <PopoverContent align="end" className="w-44 p-1">
        <Command shouldFilter={false}>
          <CommandList>
            {options.length === 0 && <CommandEmpty>No supported providers found.</CommandEmpty>}
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.id}
                  onSelect={() => {
                    onChange(option.id)
                    setOpen(false)
                  }}
                >
                  {option.label}
                  {option.id === value && <Check className="ml-auto" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/**
 * This app's own preferences: how it looks, how it renders a diff, which model it asks for a
 * commit message. All of it is saved on this machine and travels with the app, not with the
 * daemon — an Environment's own settings live under Environments and Share.
 */
export function GeneralSection(): React.JSX.Element {
  const { models, isLoading: areModelsLoading } = useCommitModels()
  const diffMode = usePreferencesStore((s) => s.diffMode)
  const setDiffMode = usePreferencesStore((s) => s.setDiffMode)
  const markdownMode = usePreferencesStore((s) => s.markdownMode)
  const setMarkdownMode = usePreferencesStore((s) => s.setMarkdownMode)
  const htmlMode = usePreferencesStore((s) => s.htmlMode) ?? 'preview'
  const setHtmlMode = usePreferencesStore((s) => s.setHtmlMode)
  const pullMode = usePreferencesStore((s) => s.pullMode)
  const setPullMode = usePreferencesStore((s) => s.setPullMode)
  const commitModel = usePreferencesStore((s) => s.commitModel ?? 'luna')
  const setCommitModel = usePreferencesStore((s) => s.setCommitModel)
  const theme = usePreferencesStore((s) => s.theme) ?? 'system'
  const setTheme = usePreferencesStore((s) => s.setTheme)
  const identity = useDaemonIdentity()
  // The Environment's name, which is its nickname once someone sets one. Two daemons on one
  // machine answer the same `host`, so the host alone cannot say which daemon served this tab.
  const connectedTo = useEnvironmentName() ?? identity.host ?? 'This daemon'

  return (
    <div className="flex flex-col gap-5">
      {/* Electron lists every Environment under Environments, and marks the one this window
          is on — repeating it here as a preference reads as something you can set. A browser
          tab has no such list: it is served BY one daemon, and this row is how it says which. */}
      {isBrowser && (
        <PreferenceRow label="Connected to" description="The daemon that served this browser tab.">
          <p data-testid={TestIds.settingsConnectedTo} className="text-sm-minus font-medium">
            {connectedTo}
          </p>
        </PreferenceRow>
      )}
      <PreferenceRow label="Appearance" description="Light, dark, or match the system.">
        <ToggleGroup
          value={[theme]}
          onValueChange={(value: string[]) => {
            const mode = value[0]
            if (mode === 'system' || mode === 'light' || mode === 'dark')
              setTheme(mode satisfies ThemeMode)
          }}
        >
          <ToggleGroupItem
            value="system"
            size="sm"
            className={compactButtonClass}
            data-testid={TestIds.settingsAppearanceSystem}
          >
            System
          </ToggleGroupItem>
          <ToggleGroupItem
            value="light"
            size="sm"
            className={compactButtonClass}
            data-testid={TestIds.settingsAppearanceLight}
          >
            Light
          </ToggleGroupItem>
          <ToggleGroupItem
            value="dark"
            size="sm"
            className={compactButtonClass}
            data-testid={TestIds.settingsAppearanceDark}
          >
            Dark
          </ToggleGroupItem>
        </ToggleGroup>
      </PreferenceRow>
      <PreferenceRow label="Diff layout" description="How file diffs are rendered.">
        <ToggleGroup
          value={[diffMode]}
          onValueChange={(value: string[]) => {
            const mode = value[0]
            if (mode === 'unified' || mode === 'split') setDiffMode(mode satisfies DiffMode)
          }}
        >
          <ToggleGroupItem value="unified" size="sm" className={compactButtonClass}>
            Unified
          </ToggleGroupItem>
          <ToggleGroupItem value="split" size="sm" className={compactButtonClass}>
            Split
          </ToggleGroupItem>
        </ToggleGroup>
      </PreferenceRow>
      <PreferenceRow label="Markdown" description="Default view when opening markdown files.">
        <ToggleGroup
          value={[markdownMode]}
          onValueChange={(value: string[]) => {
            const mode = value[0]
            if (mode === 'reader' || mode === 'source') setMarkdownMode(mode satisfies MarkdownMode)
          }}
        >
          <ToggleGroupItem value="reader" size="sm" className={compactButtonClass}>
            Reader
          </ToggleGroupItem>
          <ToggleGroupItem value="source" size="sm" className={compactButtonClass}>
            Source
          </ToggleGroupItem>
        </ToggleGroup>
      </PreferenceRow>
      <PreferenceRow
        label="HTML"
        description="Default view when opening .html files (sandboxed preview)."
      >
        <ToggleGroup
          value={[htmlMode]}
          onValueChange={(value: string[]) => {
            const mode = value[0]
            if (mode === 'preview' || mode === 'source') setHtmlMode(mode satisfies HtmlMode)
          }}
        >
          <ToggleGroupItem value="preview" size="sm" className={compactButtonClass}>
            Preview
          </ToggleGroupItem>
          <ToggleGroupItem value="source" size="sm" className={compactButtonClass}>
            Source
          </ToggleGroupItem>
        </ToggleGroup>
      </PreferenceRow>
      <PreferenceRow label="Pull strategy" description="How the git pull quick command reconciles.">
        <ToggleGroup
          value={[pullMode]}
          onValueChange={(value: string[]) => {
            const mode = value[0]
            if (mode === 'merge' || mode === 'rebase') setPullMode(mode satisfies PullMode)
          }}
        >
          <ToggleGroupItem value="merge" size="sm" className={compactButtonClass}>
            Merge
          </ToggleGroupItem>
          <ToggleGroupItem value="rebase" size="sm" className={compactButtonClass}>
            Rebase
          </ToggleGroupItem>
        </ToggleGroup>
      </PreferenceRow>
      <PreferenceRow
        label="Commit message model"
        description={`Model used for generated commit messages and commit groups, from the providers ${connectedTo} can reach. Effort is fixed at medium.`}
      >
        <CommitModelPicker
          value={commitModel}
          onChange={setCommitModel}
          options={models}
          isLoading={areModelsLoading}
        />
      </PreferenceRow>
    </div>
  )
}
