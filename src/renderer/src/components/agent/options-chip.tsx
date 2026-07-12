import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import { useUpdateAgentThread } from '@renderer/hooks/use-agents'
import type { ModelInfo, ThreadOptions } from '@shared/agent-protocol'
import { SlidersHorizontal } from 'lucide-react'

// Effort values are opaque driver strings; the labels the human reads. Unknown
// values (a future rung) fall back to a plain capitalization.
const EFFORT_LABEL: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Extra High',
  max: 'Max',
}

function effortLabel(value: string): string {
  return EFFORT_LABEL[value] ?? value.charAt(0).toUpperCase() + value.slice(1)
}

function contextWindowLabel(value: string): string {
  return value === '1m' ? '1M' : value
}

/**
 * The composer's model-options chip — "High · 200k" next to the model picker. A
 * DropdownMenu with a Reasoning section (the model's effort rungs) and a Context Window
 * section (200k/1M), each only when the SELECTED model advertises it; a model with
 * neither control renders nothing. Selecting persists onto the thread's `options`
 * (merged, so picking an effort keeps the chosen window and vice versa).
 */
export function OptionsChip({
  threadId,
  modelInfo,
  options,
}: {
  threadId: string
  modelInfo: ModelInfo | undefined
  options: ThreadOptions | undefined
}): React.JSX.Element | null {
  const { update } = useUpdateAgentThread()
  const efforts = modelInfo?.efforts
  const contextWindows = modelInfo?.contextWindows
  if (!efforts && !contextWindows) return null

  const effort = options?.effort ?? efforts?.default
  const contextWindow = options?.contextWindow ?? contextWindows?.default
  const parts: string[] = []
  if (efforts && effort !== undefined) parts.push(effortLabel(effort))
  if (contextWindows && contextWindow !== undefined) parts.push(contextWindowLabel(contextWindow))

  const setOption = (patch: ThreadOptions): void => {
    update(threadId, { options: { ...options, ...patch } })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="xs"
            aria-label="Model options"
            className="gap-1 text-muted-foreground"
          >
            <SlidersHorizontal className="size-3" />
            <span className="truncate">{parts.join(' · ')}</span>
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="min-w-44">
        {efforts && (
          <DropdownMenuGroup>
            <DropdownMenuLabel>Reasoning</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={effort}
              onValueChange={(value) => setOption({ effort: value as string })}
            >
              {efforts.values.map((value) => (
                <DropdownMenuRadioItem key={value} value={value} className="whitespace-nowrap">
                  {effortLabel(value)}
                  {value === efforts.default && (
                    <span className="ml-auto pl-3 text-2xs text-muted-foreground">Default</span>
                  )}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        )}
        {efforts && contextWindows && <DropdownMenuSeparator />}
        {contextWindows && (
          <DropdownMenuGroup>
            <DropdownMenuLabel>Context Window</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={contextWindow}
              onValueChange={(value) => setOption({ contextWindow: value as string })}
            >
              {contextWindows.values.map((value) => (
                <DropdownMenuRadioItem key={value} value={value} className="whitespace-nowrap">
                  {contextWindowLabel(value)}
                  {value === contextWindows.default && (
                    <span className="ml-auto pl-3 text-2xs text-muted-foreground">Default</span>
                  )}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
