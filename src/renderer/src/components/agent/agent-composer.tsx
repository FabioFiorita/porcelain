import { ModelPicker } from '@renderer/components/agent/model-picker'
import { OptionsChip } from '@renderer/components/agent/options-chip'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import { Kbd } from '@renderer/components/ui/kbd'
import { Textarea } from '@renderer/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@renderer/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useAgentActions } from '@renderer/hooks/use-agent-channel'
import { useAgentProviders, useUpdateAgentThread } from '@renderer/hooks/use-agents'
import { cn } from '@renderer/lib/utils'
import type {
  AgentImage,
  AgentInteraction,
  AgentMode,
  AgentProvider,
  ThreadOptions,
} from '@shared/agent-protocol'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowUp,
  Hammer,
  ImagePlus,
  NotebookPen,
  ShieldCheck,
  ShieldOff,
  ShieldQuestion,
  Square,
  X,
} from 'lucide-react'
import { useRef, useState } from 'react'

const MODE_LABEL: Record<AgentMode, string> = {
  approve: 'Ask to approve',
  'auto-edits': 'Auto-accept edits',
  full: 'Full access',
}

// One shield per permission posture — the same icon on the trigger chip and its menu
// row, so the closed chip always reads in the menu's own icon language.
const MODE_ICON: Record<AgentMode, LucideIcon> = {
  approve: ShieldQuestion,
  'auto-edits': ShieldCheck,
  full: ShieldOff,
}

const PROVIDER_LABEL: Record<AgentProvider, string> = {
  claude: 'Claude Code',
  codex: 'Codex',
  opencode: 'OpenCode',
}

interface Attachment {
  id: string
  mediaType: string
  base64: string
  dataUrl: string
}

/** Read a File into an in-memory image attachment (base64 for the wire, data URL for the chip). */
function readImage(file: File): Promise<Attachment | null> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve(null)
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : ''
      const base64 = dataUrl.split(',')[1] ?? ''
      resolve({ id: `${Date.now()}-${Math.random()}`, mediaType: file.type, base64, dataUrl })
    }
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(file)
  })
}

/**
 * The thread composer: an auto-growing message field with an image tray, and a footer
 * control cluster — model picker, model-options chip, permission-mode menu, and the
 * Build/Plan toggle on the left, send/stop on the right (the button flips to Stop →
 * abort while the turn is working). Enter sends; Shift+Enter inserts a newline;
 * Shift+Tab flips Build↔Plan. Disabled with a hint when the provider CLI is missing.
 */
export function AgentComposer({
  threadId,
  provider,
  model,
  mode,
  interaction,
  options,
  working,
}: {
  threadId: string
  provider: AgentProvider
  model: string
  mode: AgentMode
  interaction: AgentInteraction
  options: ThreadOptions | undefined
  working: boolean
}): React.JSX.Element {
  const { send, abort } = useAgentActions()
  const { update } = useUpdateAgentThread()
  const providers = useAgentProviders()
  const [text, setText] = useState('')
  const [images, setImages] = useState<Attachment[]>([])
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const providerStatus = providers.find((p) => p.provider === provider)
  const modelInfo = providerStatus?.models.find((m) => m.id === model)
  const ModeIcon = MODE_ICON[mode]
  // Providers come from an async probe; treat "unknown yet" as available so a slow probe
  // doesn't lock the composer, and only hard-disable once we KNOW the CLI is missing.
  const installed = providerStatus?.installed ?? true
  const canSend = installed && (text.trim() !== '' || images.length > 0)

  const addFiles = async (files: FileList | File[]): Promise<void> => {
    const read = await Promise.all(Array.from(files).map(readImage))
    const next = read.filter((image): image is Attachment => image !== null)
    if (next.length > 0) setImages((current) => [...current, ...next])
  }

  const toggleInteraction = (): void => {
    update(threadId, { interaction: interaction === 'plan' ? 'build' : 'plan' })
  }

  const submit = (): void => {
    if (!canSend) return
    const payload: { text: string; images?: AgentImage[] } = { text: text.trim() }
    if (images.length > 0) {
      payload.images = images.map((image) => ({ mediaType: image.mediaType, base64: image.base64 }))
    }
    send(threadId, payload)
    setText('')
    setImages([])
  }

  return (
    <div className="px-3 pb-3">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: image drop target wrapping the textarea */}
      <div
        className={cn(
          'glaze-tile flex flex-col gap-2 rounded-xl p-2 [--tile-fill:var(--surface-2)]',
          dragging && 'ring-2 ring-ring/50',
        )}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={async (e) => {
          e.preventDefault()
          setDragging(false)
          if (e.dataTransfer.files.length > 0) await addFiles(e.dataTransfer.files)
        }}
      >
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2 px-1 pt-1">
            {images.map((image) => (
              <div key={image.id} className="group/thumb relative size-14 shrink-0">
                <img
                  src={image.dataUrl}
                  alt="Attachment"
                  className="size-14 rounded-md border border-border object-cover"
                />
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Remove attachment"
                  className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-popover ring-1 ring-border"
                  onClick={() => setImages((current) => current.filter((i) => i.id !== image.id))}
                >
                  <X />
                </Button>
              </div>
            ))}
          </div>
        )}
        <Textarea
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={!installed}
          placeholder={
            installed
              ? 'Message the agent…'
              : `${PROVIDER_LABEL[provider]} isn’t installed — install its CLI to chat.`
          }
          aria-label="Message the agent"
          onPaste={async (e) => {
            const files = Array.from(e.clipboardData.files)
            if (files.length > 0) {
              e.preventDefault()
              await addFiles(files)
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
              return
            }
            // Shift+Tab flips Build↔Plan without leaving the field; plain Tab keeps
            // its default focus move.
            if (e.key === 'Tab' && e.shiftKey) {
              e.preventDefault()
              toggleInteraction()
            }
          }}
          className="max-h-48 min-h-9 resize-none border-0 bg-transparent px-1.5 py-1 shadow-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
        />
        <div className="flex items-center gap-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={async (e) => {
              const { files } = e.target
              e.target.value = '' // reset synchronously so re-picking the same file re-fires
              if (files && files.length > 0) await addFiles(files)
            }}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Attach image"
            disabled={!installed}
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus />
          </Button>
          <ModelPicker threadId={threadId} provider={provider} model={model} />
          <OptionsChip threadId={threadId} modelInfo={modelInfo} options={options} />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="xs" className="gap-1 text-muted-foreground">
                  <ModeIcon className="size-3" />
                  <span className="truncate">{MODE_LABEL[mode]}</span>
                </Button>
              }
            />
            <DropdownMenuContent align="start" className="min-w-44">
              <DropdownMenuRadioGroup
                value={mode}
                onValueChange={(value) => update(threadId, { mode: value as AgentMode })}
              >
                {(Object.keys(MODE_LABEL) as AgentMode[]).map((value) => {
                  const Icon = MODE_ICON[value]
                  return (
                    <DropdownMenuRadioItem key={value} value={value} className="whitespace-nowrap">
                      <Icon className="size-3.5 text-muted-foreground" />
                      {MODE_LABEL[value]}
                    </DropdownMenuRadioItem>
                  )
                })}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Tooltip>
            <TooltipTrigger
              render={
                <ToggleGroup
                  aria-label="Interaction mode"
                  className="gap-0.5"
                  value={[interaction]}
                  onValueChange={(value: string[]) => {
                    const next = value[0]
                    if ((next === 'build' || next === 'plan') && next !== interaction) {
                      update(threadId, { interaction: next })
                    }
                  }}
                >
                  <ToggleGroupItem
                    value="build"
                    aria-label="Build"
                    className="h-6 min-w-0 gap-1 px-2 text-xs"
                  >
                    <Hammer className="size-3.5" />
                    Build
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="plan"
                    aria-label="Plan"
                    className="h-6 min-w-0 gap-1 px-2 text-xs"
                  >
                    <NotebookPen className="size-3.5" />
                    Plan
                  </ToggleGroupItem>
                </ToggleGroup>
              }
            />
            <TooltipContent className="flex items-center gap-1.5">
              Build or plan first <Kbd>⇧⇥</Kbd>
            </TooltipContent>
          </Tooltip>
          <div className="flex-1" />
          {working ? (
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Stop"
              onClick={() => abort(threadId)}
            >
              <Square className="fill-current" />
            </Button>
          ) : (
            <Button size="icon-sm" aria-label="Send" disabled={!canSend} onClick={submit}>
              <ArrowUp />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
