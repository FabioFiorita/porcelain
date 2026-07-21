import {
  ComposerCompletion,
  useComposerCompletion,
} from '@renderer/components/agent/composer-completion'
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useAgentActions } from '@renderer/hooks/use-agent-channel'
import { useAgentProviders, useUpdateAgentThread } from '@renderer/hooks/use-agents'
import { makeThumbnail } from '@renderer/lib/image-thumbnail'
import { cn } from '@renderer/lib/utils'
import { type Attachment, useAgentDraftsStore } from '@renderer/stores/agent-drafts'
import type {
  AgentImage,
  AgentInteraction,
  AgentMode,
  AgentProvider,
  ThreadOptions,
} from '@shared/agent-protocol'
import { PROVIDER_LABEL } from '@shared/agent-protocol'
import { TestIds } from '@shared/test-ids'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowUp,
  ChevronDown,
  Hammer,
  ImagePlus,
  NotebookPen,
  ShieldCheck,
  ShieldOff,
  ShieldQuestion,
  Square,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

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

// Build vs Plan reads as a permission-mode sibling: one chip, one dropdown, same icons on
// the trigger and its radio rows.
const INTERACTION_LABEL: Record<AgentInteraction, string> = {
  build: 'Build',
  plan: 'Plan',
}

const INTERACTION_ICON: Record<AgentInteraction, LucideIcon> = {
  build: Hammer,
  plan: NotebookPen,
}

/** Read a File into an in-memory image attachment (base64 for the wire, data URL for the chip). */
function readImage(file: File): Promise<Attachment | null> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve(null)
      return
    }
    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : ''
      const base64 = dataUrl.split(',')[1] ?? ''
      // Downscale up front (at attach time) so submit stays synchronous and the thumbnail is
      // ready to persist alongside the message.
      const thumbnail = dataUrl === '' ? null : await makeThumbnail(dataUrl)
      resolve({
        id: `${Date.now()}-${Math.random()}`,
        mediaType: file.type,
        base64,
        dataUrl,
        thumbnail,
      })
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
  resolvedModel,
  mode,
  interaction,
  options,
  working,
  prefill,
  onPrefillConsumed,
}: {
  threadId: string
  provider: AgentProvider
  model: string
  // The CLI-reported model for the session; the picker uses it to label a default-model thread.
  resolvedModel: string | undefined
  mode: AgentMode
  interaction: AgentInteraction
  options: ThreadOptions | undefined
  working: boolean
  // Text to drop into the (empty) field — the empty-timeline example chips push a prompt here.
  // Consumed once via `onPrefillConsumed`, so a repeat pick of the same prompt still fires.
  // Queued mid-turn messages render in the timeline ("Up next"), not here — the composer sits
  // under the last reply, so chips here read as "sent after the response".
  prefill: string | null
  onPrefillConsumed: () => void
}): React.JSX.Element {
  const { send, abort } = useAgentActions()
  const { update } = useUpdateAgentThread()
  const providers = useAgentProviders()
  // Drafts live in a per-thread store, not local state, so a viewer-tab switch (which unmounts
  // this view) doesn't destroy a half-written message; text also survives a reload (see the store).
  const draft = useAgentDraftsStore((s) => s.drafts[threadId])
  const setDraft = useAgentDraftsStore((s) => s.setDraft)
  const clearDraft = useAgentDraftsStore((s) => s.clearDraft)
  const text = draft?.text ?? ''
  const images = draft?.images ?? []
  const setText = (value: string): void => setDraft(threadId, { text: value })
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const completion = useComposerCompletion({
    value: text,
    provider,
    textareaRef,
    onChange: setText,
  })

  const providerStatus = providers.find((p) => p.provider === provider)
  const modelInfo = providerStatus?.models.find((m) => m.id === model)
  const ModeIcon = MODE_ICON[mode]
  const InteractionIcon = INTERACTION_ICON[interaction]
  // Providers come from an async probe; treat "unknown yet" as available so a slow probe
  // doesn't lock the composer, and only hard-disable once we KNOW the CLI is missing.
  const installed = providerStatus?.installed ?? true
  const canSend = installed && (text.trim() !== '' || images.length > 0)

  const addFiles = async (files: FileList | File[]): Promise<void> => {
    const read = await Promise.all(Array.from(files).map(readImage))
    const next = read.filter((image): image is Attachment => image !== null)
    if (next.length === 0) return
    // Read fresh from the store — this runs after an await, so the closed-over `images` may be
    // stale (mirrors the old functional setState).
    const current = useAgentDraftsStore.getState().drafts[threadId]?.images ?? []
    setDraft(threadId, { images: [...current, ...next] })
  }

  const toggleInteraction = (): void => {
    update(threadId, { interaction: interaction === 'plan' ? 'build' : 'plan' })
  }

  // Drop a picked example prompt into the field and focus it, consuming the prefill so the
  // same prompt can be picked again later. Uses the stable store action directly (setText is a
  // fresh closure each render, so it can't be an effect dependency).
  useEffect(() => {
    if (prefill === null) return
    setDraft(threadId, { text: prefill })
    onPrefillConsumed()
    textareaRef.current?.focus()
  }, [prefill, onPrefillConsumed, setDraft, threadId])

  const submit = (): void => {
    if (!canSend) return
    const payload: { text: string; images?: AgentImage[]; thumbnails?: AgentImage[] } = {
      text: text.trim(),
    }
    if (images.length > 0) {
      payload.images = images.map((image) => ({ mediaType: image.mediaType, base64: image.base64 }))
      const thumbnails = images
        .map((image) => image.thumbnail)
        .filter((thumb): thumb is AgentImage => thumb !== null)
      if (thumbnails.length > 0) payload.thumbnails = thumbnails
    }
    send(threadId, payload)
    clearDraft(threadId)
  }

  const stop = (): void => {
    // Steer-then-stop: append the typed draft to the FIFO queue, then abort. Ordering contract
    // — both ride the same ordered WS socket, so the daemon sees the send BEFORE the abort and
    // drains the front of the queue the instant the aborted turn ends. Always append when the
    // draft is non-empty (queue stacks; never clobber prior chips).
    if (canSend) submit()
    abort(threadId)
  }

  return (
    <div className="px-3 pb-3">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: image drop target wrapping the textarea */}
      <div
        className={cn(
          'flex flex-col gap-2 rounded-xl border bg-card p-2',
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
                  onClick={() =>
                    setDraft(threadId, { images: images.filter((i) => i.id !== image.id) })
                  }
                >
                  <X />
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="relative">
          <ComposerCompletion
            open={completion.open}
            items={completion.items}
            selectedIndex={completion.selectedIndex}
            onSelect={completion.onSelect}
          />
          <Textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              completion.onCaretChange(e.target.selectionStart ?? 0)
            }}
            onKeyUp={completion.syncCaret}
            onClick={completion.syncCaret}
            disabled={!installed}
            placeholder={
              installed
                ? `Message ${PROVIDER_LABEL[provider]}… (@ files, / commands)`
                : `${PROVIDER_LABEL[provider]} isn’t installed — install its CLI to chat.`
            }
            aria-label="Message the agent"
            data-testid={TestIds.agentComposer}
            onPaste={async (e) => {
              const files = Array.from(e.clipboardData.files)
              if (files.length > 0) {
                e.preventDefault()
                await addFiles(files)
              }
            }}
            onKeyDown={(e) => {
              // The completion popup gets first refusal on navigation/commit keys so an
              // open list intercepts Enter/Tab/arrows (and never lets Enter send).
              if (completion.handleKeyDown(e)) return
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
        </div>
        <div className="@container/composer flex items-center gap-1">
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
          <ModelPicker
            threadId={threadId}
            provider={provider}
            model={model}
            resolvedModel={resolvedModel}
          />
          <OptionsChip threadId={threadId} modelInfo={modelInfo} options={options} />
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger
                render={
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="xs"
                        aria-label={MODE_LABEL[mode]}
                        data-testid={TestIds.agentModeChip}
                        className="gap-1 text-muted-foreground/70 hover:text-muted-foreground"
                      >
                        <ModeIcon className="size-3" />
                        <span className="truncate @max-[30rem]/composer:hidden">
                          {MODE_LABEL[mode]}
                        </span>
                      </Button>
                    }
                  />
                }
              />
              <TooltipContent>{MODE_LABEL[mode]}</TooltipContent>
            </Tooltip>
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
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger
                render={
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="xs"
                        aria-label="Interaction mode"
                        className="gap-1 text-muted-foreground/70 hover:text-muted-foreground"
                      >
                        <InteractionIcon className="size-3" />
                        <span className="truncate @max-[30rem]/composer:hidden">
                          {INTERACTION_LABEL[interaction]}
                        </span>
                        <ChevronDown className="size-3 @max-[30rem]/composer:hidden" />
                      </Button>
                    }
                  />
                }
              />
              <TooltipContent className="flex items-center gap-1.5">
                Build or plan first <Kbd>⇧⇥</Kbd>
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start" className="min-w-44">
              <DropdownMenuRadioGroup
                value={interaction}
                onValueChange={(value) => {
                  if ((value === 'build' || value === 'plan') && value !== interaction) {
                    update(threadId, { interaction: value })
                  }
                }}
              >
                {(Object.keys(INTERACTION_LABEL) as AgentInteraction[]).map((value) => {
                  const Icon = INTERACTION_ICON[value]
                  return (
                    <DropdownMenuRadioItem key={value} value={value} className="whitespace-nowrap">
                      <Icon className="size-3.5 text-muted-foreground" />
                      {INTERACTION_LABEL[value]}
                    </DropdownMenuRadioItem>
                  )
                })}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex-1" />
          {working ? (
            <>
              {/* Mid-turn the draft has nowhere to go by button alone — Send queues it (daemon
                  single-slot) so the user can steer without stopping the turn. Stop still wins
                  the row's trailing spot. */}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      size="icon-sm"
                      aria-label="Send"
                      data-testid={TestIds.agentSend}
                      disabled={!canSend}
                      onClick={submit}
                    >
                      <ArrowUp />
                    </Button>
                  }
                />
                <TooltipContent>Queue message — runs when the current turn ends</TooltipContent>
              </Tooltip>
              <Button variant="outline" size="icon-sm" aria-label="Stop" onClick={stop}>
                <Square className="fill-current" />
              </Button>
            </>
          ) : (
            <Button
              size="icon-sm"
              aria-label="Send"
              data-testid={TestIds.agentSend}
              disabled={!canSend}
              onClick={submit}
            >
              <ArrowUp />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
