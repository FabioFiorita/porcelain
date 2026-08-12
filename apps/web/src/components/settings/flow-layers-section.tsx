import type { Layer } from '@porcelain/contracts/project-data'
import { SetupTip } from '@renderer/components/shell/setup-tip'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@renderer/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useGitFlow } from '@renderer/features/git'
import { toastUserActionError } from '@renderer/hooks/mutation-error'
import { useProjectLayers, useSetProjectLayers } from '@renderer/hooks/use-project-layers'
import { layersSetupPrompt } from '@renderer/lib/agent-setup-prompts'
import { compactButtonClass, compactInputClass } from '@renderer/lib/controls'
import { cn, copyText } from '@renderer/lib/utils'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { useSetupTipsStore } from '@renderer/stores/setup-tips'
import { runUserAction } from '@shared/background'
import { TestIds } from '@shared/test-ids'
import { Check, ChevronDown, ChevronUp, Copy, Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'

const patternError = (pattern: string): string | null => {
  if (pattern.trim() === '') return 'pattern is required'
  try {
    new RegExp(pattern)
    return null
  } catch {
    return 'invalid regular expression'
  }
}

type MatchType = 'folder' | 'ext' | 'suffix'

// Escape regex metacharacters so a typed name (e.g. `api.client`) stays literal.
const escapeRe = (name: string): string => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const splitNames = (raw: string): string[] =>
  raw
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean)

// Turn the picked match type + names into the regex the flow grouper tests against
// the project-relative path — the same three shapes the defaults use.
const buildPattern = (type: MatchType, names: string[]): string => {
  if (names.length === 0) return ''
  const alt = `(${names.map(escapeRe).join('|')})`
  if (type === 'folder') return `(^|/)${alt}/`
  if (type === 'ext') return `\\.${alt}$`
  return `\\.${alt}\\.[a-z]+$`
}

const deriveLabel = (names: string[]): string => {
  const first = names[0] ?? ''
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : 'New layer'
}

const PLACEHOLDERS: Record<MatchType, string> = {
  folder: 'components, views',
  ext: 'ts, tsx',
  suffix: 'test, spec',
}

const MATCH_HELP: Record<MatchType, string> = {
  folder: 'Files inside a folder of this name, e.g. src/components/Button.tsx.',
  ext: 'Files with this extension, e.g. config.yaml.',
  suffix: 'Files whose name ends with this before the extension, e.g. user.test.ts.',
}

const EXAMPLE_LIMIT = 6

// Which of the current changed paths the built pattern catches — a live, concrete
// preview so you can confirm the match type before adding the layer (a yaml file
// is `.yaml` = Extension, not `.yaml.x` = Suffix).
const matchingPaths = (pattern: string, paths: readonly string[]): string[] => {
  if (pattern === '') return []
  let re: RegExp
  try {
    re = new RegExp(pattern)
  } catch {
    return []
  }
  return paths.filter((p) => re.test(p))
}

// Compose a layer pattern from a match type + a few names instead of hand-writing
// the regex; the generated pattern is previewed live and added as a fresh layer
// (still editable by hand below). Replaces the old wall of explanatory text.
function PatternBuilder({
  onAdd,
  changedPaths,
}: {
  onAdd: (layer: Layer) => void
  changedPaths: readonly string[]
}): React.JSX.Element {
  const [matchType, setMatchType] = useState<MatchType>('folder')
  const [names, setNames] = useState('')
  const parsed = splitNames(names)
  const preview = buildPattern(matchType, parsed)
  const matches = matchingPaths(preview, changedPaths)

  const handleAdd = (): void => {
    if (parsed.length === 0) return
    onAdd({ label: deriveLabel(parsed), pattern: preview })
    setNames('')
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-md border bg-muted/40 p-3">
      {/* Same type scale as other Settings sections (labels sm-minus, body xs). */}
      <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
        Pattern builder
      </p>
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-xs text-muted-foreground">Match</span>
        <ToggleGroup
          value={[matchType]}
          onValueChange={(value: string[]) => {
            const type = value[0]
            if (type === 'folder' || type === 'ext' || type === 'suffix') setMatchType(type)
          }}
        >
          <ToggleGroupItem value="folder" size="sm" className={compactButtonClass}>
            Folder
          </ToggleGroupItem>
          <ToggleGroupItem value="ext" size="sm" className={compactButtonClass}>
            Extension
          </ToggleGroupItem>
          <ToggleGroupItem value="suffix" size="sm" className={compactButtonClass}>
            Suffix
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-xs text-muted-foreground">Names</span>
        <Input
          value={names}
          onChange={(e: React.ChangeEvent<HTMLInputElement>): void => setNames(e.target.value)}
          placeholder={PLACEHOLDERS[matchType]}
          aria-label="Pattern names"
          className={cn(compactInputClass, 'flex-1')}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>): void => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAdd()
            }
          }}
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-xs text-muted-foreground">Pattern</span>
        <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1.5 font-mono text-xs text-ink-green">
          {preview || '—'}
        </code>
        <Button
          size="sm"
          className={compactButtonClass}
          disabled={parsed.length === 0}
          onClick={handleAdd}
        >
          <Plus /> Add
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{MATCH_HELP[matchType]}</p>
      {parsed.length > 0 && (
        <div className="flex flex-col gap-0.5 rounded-md bg-muted px-2.5 py-2">
          {changedPaths.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No changed files to preview against right now.
            </p>
          ) : matches.length === 0 ? (
            <p className="text-xs text-amber-500/90">
              No changed files match this pattern — try a different match type above.
            </p>
          ) : (
            <>
              <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                Matches {matches.length} changed {matches.length === 1 ? 'file' : 'files'}
              </p>
              {matches.slice(0, EXAMPLE_LIMIT).map((p) => (
                <code key={p} className="block truncate font-mono text-xs text-ink-green">
                  {p}
                </code>
              ))}
              {matches.length > EXAMPLE_LIMIT && (
                <p className="text-xs text-muted-foreground">
                  +{matches.length - EXAMPLE_LIMIT} more
                </p>
              )}
            </>
          )}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Furthest-right match wins; unmatched files fall into{' '}
        <span className="text-foreground">Other</span>. You can still edit any pattern by hand
        below.
      </p>
    </div>
  )
}

function LayerRow({
  layer,
  index,
  count,
  onChange,
  onMove,
  onRemove,
}: {
  layer: Layer
  index: number
  count: number
  onChange: (layer: Layer) => void
  onMove: (direction: 1 | -1) => void
  onRemove: () => void
}): React.JSX.Element {
  const error = patternError(layer.pattern)

  return (
    <div className="flex items-start gap-1.5">
      <Input
        value={layer.label}
        onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
          onChange({ ...layer, label: e.target.value })
        }
        placeholder="Label"
        aria-label={`Layer ${index + 1} label`}
        className={cn(compactInputClass, 'w-28 shrink-0')}
      />
      <div className="min-w-0 flex-1">
        <Input
          value={layer.pattern}
          onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
            onChange({ ...layer, pattern: e.target.value })
          }
          placeholder="Pattern (regex)"
          aria-label={`Layer ${index + 1} pattern`}
          aria-invalid={error !== null}
          className={cn(compactInputClass, 'font-mono')}
        />
        {error && <p className="mt-0.5 text-xs text-destructive">{error}</p>}
      </div>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={index === 0}
              onClick={() => onMove(-1)}
              aria-label="Move layer up"
            >
              <ChevronUp />
            </Button>
          }
        />
        <TooltipContent>Move layer up</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={index === count - 1}
              onClick={() => onMove(1)}
              aria-label="Move layer down"
            >
              <ChevronDown />
            </Button>
          }
        />
        <TooltipContent>Move layer down</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={count === 1}
              onClick={onRemove}
              aria-label="Remove layer"
            >
              <X />
            </Button>
          }
        />
        <TooltipContent>Remove layer</TooltipContent>
      </Tooltip>
    </div>
  )
}

interface DraftLayer extends Layer {
  /** Stable client-side key so rows keep focus while reordering. */
  id: number
}

let nextDraftId = 0
const toDraft = (layers: Layer[]): DraftLayer[] =>
  layers.map((layer) => ({ ...layer, id: nextDraftId++ }))

export function FlowLayersSection({ onSaved }: { onSaved: () => void }): React.JSX.Element | null {
  const project = useProjectSelectionStore((s) => s.project)
  const [draft, setDraft] = useState<DraftLayer[]>([])
  const [copied, setCopied] = useState(false)
  const data = useProjectLayers()
  const { groups } = useGitFlow()
  const changedPaths = (groups ?? []).flatMap((g) => g.files.map((f) => f.path))
  const { save: saveLayers, isSaving } = useSetProjectLayers()
  const settingsTipDismissed = useSetupTipsStore((s) =>
    project ? s.dismissed[project.path]?.['layers-settings'] === true : true,
  )
  const dismissTip = useSetupTipsStore((s) => s.dismiss)
  // custom=false → still on Docs + Agents starters; tip is dismissible and goes away after save
  const showSetup = data !== undefined && !data.custom && !settingsTipDismissed

  // seed the draft from the saved layers each time the section mounts/refetches
  useEffect(() => {
    if (data) setDraft(toDraft(data.layers))
  }, [data])

  if (!project) return null

  const valid = draft.every((l) => l.label.trim() !== '' && patternError(l.pattern) === null)

  const handleUpdate = (index: number, layer: Layer): void => {
    setDraft(draft.map((l, i) => (i === index ? { ...l, ...layer } : l)))
  }

  const handleMove = (index: number, direction: 1 | -1): void => {
    const next = [...draft]
    const [layer] = next.splice(index, 1)
    if (layer) next.splice(index + direction, 0, layer)
    setDraft(next)
  }

  const handleSave = (layers: DraftLayer[] | null): void => {
    runUserAction(
      async () => {
        await saveLayers(layers?.map(({ label, pattern }) => ({ label, pattern })) ?? null)
        onSaved()
      },
      (error) => {
        toastUserActionError('Save layers', error)
      },
    )
  }

  const handleCopySetup = async (): Promise<void> => {
    await copyText(layersSetupPrompt())
    setCopied(true)
  }

  return (
    <div className="flex flex-col gap-3">
      {showSetup && (
        <SetupTip
          testId={TestIds.layersStarterBanner}
          dismissTestId={TestIds.layersStarterDismiss}
          className="border bg-muted/40 p-3 pr-9"
          onDismiss={() => dismissTip(project.path, 'layers-settings')}
          actions={
            <Button
              variant="outline"
              size="sm"
              className={cn(compactButtonClass, 'self-start')}
              data-testid={TestIds.layersCopySetup}
              onClick={() => {
                runUserAction(
                  async () => {
                    await handleCopySetup()
                  },
                  (error) => {
                    toastUserActionError('Copy setup prompt', error)
                  },
                )
              }}
            >
              {copied ? <Check className="text-success" /> : <Copy />}
              {copied ? 'Copied' : 'Copy setup prompt'}
            </Button>
          }
        >
          <p className="text-xs font-medium text-foreground">Starter groups for this tree</p>
          <p className="text-xs text-muted-foreground">
            Every project starts with <span className="text-foreground">Docs</span> and{' '}
            <span className="text-foreground">Agents</span> only — not a framework stack. Layers are
            agent-managed for <em>this</em> repository; product code lands in Other until you or
            your agent tune the set. Dismiss this tip anytime; it also leaves after layers are
            saved.
          </p>
        </SetupTip>
      )}
      <PatternBuilder
        changedPaths={changedPaths}
        onAdd={(layer: Layer): void => setDraft([...draft, { ...layer, id: nextDraftId++ }])}
      />
      <div className="flex flex-col gap-1">
        {draft.map((layer, index) => (
          <LayerRow
            key={layer.id}
            layer={layer}
            index={index}
            count={draft.length}
            onChange={(l: Layer): void => handleUpdate(index, l)}
            onMove={(d: 1 | -1): void => handleMove(index, d)}
            onRemove={() => setDraft(draft.filter((_, i) => i !== index))}
          />
        ))}
        <Button
          variant="ghost"
          size="sm"
          className={cn(compactButtonClass, 'self-start')}
          onClick={() => setDraft([...draft, { label: '', pattern: '', id: nextDraftId++ }])}
        >
          <Plus /> Add layer
        </Button>
      </div>
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          className={compactButtonClass}
          disabled={showSetup}
          onClick={() => handleSave(null)}
        >
          Reset to starters
        </Button>
        <Button
          size="sm"
          className={compactButtonClass}
          disabled={!valid || isSaving}
          onClick={() => handleSave(draft)}
        >
          Save
        </Button>
      </div>
    </div>
  )
}
