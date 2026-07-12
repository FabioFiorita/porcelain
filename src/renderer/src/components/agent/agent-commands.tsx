import { useCreateAgentThread } from '@renderer/hooks/use-agents'
import { isTerminalTarget, isTextEntry } from '@renderer/lib/keyboard'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { useEffect } from 'react'

/**
 * Agent-tab keyboard shortcut: ⌘N starts a new thread. Lives in its own always-mounted
 * component (next to FileCommands) rather than the global shortcut hook because the create
 * goes through a tRPC hook, which only components may touch (the global hook is under
 * components/**, where importing lib/trpc is a lint error). Active only while the Agent tab
 * is showing; ⌘N on other tabs is owned by use-app-shortcuts / FileCommands.
 */
export function AgentCommands(): null {
  const { create } = useCreateAgentThread()

  useEffect(() => {
    const onKeyDown = async (e: KeyboardEvent): Promise<void> => {
      if (usePreferencesStore.getState().sidebarTab !== 'agent') return
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return
      if (isTextEntry(e.target) || isTerminalTarget(e.target)) return
      if (e.key.toLowerCase() !== 'n') return
      e.preventDefault()
      const thread = await create({ mode: 'full' })
      if (thread) {
        useTabsStore.getState().openTab({
          id: tabId('agent', thread.id),
          kind: 'agent',
          title: thread.title,
          path: thread.id,
        })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [create])

  return null
}
