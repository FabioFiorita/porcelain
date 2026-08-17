import {
  LocalPathDialog,
  type LocalPathDialogMode,
} from '@renderer/components/terminal/local-path-dialog'
import { TerminalRenameDialog } from '@renderer/components/terminal/terminal-rename-dialog'
import { TerminalView } from '@renderer/components/terminal/terminal-view'
import { Button } from '@renderer/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@renderer/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import { toastUserActionError } from '@renderer/hooks/mutation-error'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import { useLocalDaemon, useLocalTerminalPath } from '@renderer/hooks/use-local-terminal'
import { spawnLocalTerminal, spawnTerminal } from '@renderer/lib/terminal-actions'
import { cn } from '@renderer/lib/utils'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { useTerminalsStore } from '@renderer/stores/terminals'
import { runUserAction } from '@shared/background'
import { TestIds } from '@shared/test-ids'
import {
  Cloud,
  FolderPen,
  Monitor,
  PanelBottomClose,
  PenLine,
  Plus,
  SquareTerminal,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'

/**
 * The persistent terminal panel at the bottom of the Viewer. Terminal sessions are tabs
 * in this panel, while the PTY remains daemon-owned when the panel is closed or the
 * browser reconnects. This keeps the live shell beside the document it supports.
 */
export function TerminalPanel(): React.JSX.Element {
  const sessions = useTerminalsStore((s) => s.sessions)
  const panelOpen = useTerminalsStore((s) => s.panelOpen)
  const panelSessionId = useTerminalsStore((s) => s.panelSessionId)
  const closeTerminal = useTerminalsStore((s) => s.close)
  const openPanel = useTerminalsStore((s) => s.openPanel)
  const closePanel = useTerminalsStore((s) => s.closePanel)
  const setPanelSession = useTerminalsStore((s) => s.setPanelSession)
  const renameTerminal = useTerminalsStore((s) => s.rename)
  const project = useProjectSelectionStore((s) => s.project)
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)
  const [mappingMode, setMappingMode] = useState<LocalPathDialogMode | null>(null)
  const localDaemon = useLocalDaemon()
  const canSpawnLocal = localDaemon !== undefined && !localDaemon.isLocal && project !== null
  const mappedLocalPath = useLocalTerminalPath(project?.path ?? null)
  const identity = useDaemonIdentity()
  const activeSession = sessions.find((session) => session.id === panelSessionId) ?? null

  useEffect(() => {
    if (panelOpen && activeSession === null && sessions[0] !== undefined) {
      setPanelSession(sessions[0].id)
    }
  }, [activeSession, panelOpen, sessions, setPanelSession])

  const handleSpawnLocal = (): void => {
    if (!project) return
    if (mappedLocalPath == null || mappedLocalPath === '') {
      setMappingMode('spawn')
      return
    }
    runUserAction(
      () => spawnLocalTerminal(mappedLocalPath),
      (error) => {
        toastUserActionError('Open local terminal', error)
      },
    )
  }

  const handleSpawnRemote = (): void => {
    runUserAction(
      () => spawnTerminal(),
      (error) => {
        toastUserActionError('Open terminal', error)
      },
    )
  }

  const handleRename = (id: string, name: string): void => {
    const trimmed = name.trim()
    if (trimmed === '') return
    renameTerminal(id, trimmed)
  }

  const hasMappedPath = mappedLocalPath != null && mappedLocalPath !== ''

  return (
    <div
      data-testid={TestIds.terminalPanel}
      className={cn('flex h-72 min-h-0 shrink-0 flex-col border-t', !panelOpen && 'hidden')}
    >
      <div className="flex min-h-10 shrink-0 items-center gap-1 px-2">
        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="flex min-w-max items-center gap-1">
            {sessions.map((session) => {
              const isActive = panelSessionId === session.id
              return (
                <ContextMenu key={session.id}>
                  <ContextMenuTrigger
                    render={
                      <div
                        className={cn(
                          'group/term flex h-7 max-w-48 shrink-0 items-center gap-1 rounded-md pl-2 text-xs',
                          isActive
                            ? 'bg-accent text-accent-foreground'
                            : 'text-muted-foreground hover:bg-accent/50',
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setPanelSession(session.id)
                            openPanel(session.id)
                          }}
                          onDoubleClick={() => setRenaming({ id: session.id, name: session.name })}
                          title={
                            session.origin === 'local'
                              ? `${session.name} — this device`
                              : session.name
                          }
                          className="flex min-w-0 items-center gap-1.5 text-left"
                        >
                          {session.origin === 'local' ? (
                            <Monitor className="size-3.5 shrink-0" />
                          ) : (
                            <SquareTerminal className="size-3.5 shrink-0" />
                          )}
                          <span className="truncate">{session.name}</span>
                        </button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="size-5 shrink-0 opacity-0 group-hover/term:opacity-100 [@media(hover:none)]:opacity-100"
                          aria-label={`Close ${session.name}`}
                          onClick={() => closeTerminal(session.id)}
                        >
                          <X />
                        </Button>
                      </div>
                    }
                  />
                  <ContextMenuContent>
                    <ContextMenuItem
                      onClick={() => setRenaming({ id: session.id, name: session.name })}
                    >
                      <PenLine />
                      Rename
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              )
            })}
          </div>
        </div>
        {canSpawnLocal && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setMappingMode('edit')}
            aria-label={hasMappedPath ? 'Change this device folder' : 'Set this device folder'}
            title={
              hasMappedPath
                ? `This device folder: ${mappedLocalPath}`
                : 'Set this device folder (local clone of this project)'
            }
            data-testid={TestIds.localTerminalPathButton}
            disabled={!project}
          >
            <FolderPen />
          </Button>
        )}
        {canSpawnLocal ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="New terminal"
                  data-testid={TestIds.terminalNew}
                >
                  <Plus />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleSpawnRemote} data-testid={TestIds.terminalNewRemote}>
                <Cloud />
                {identity.host ?? 'This window’s machine'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSpawnLocal} data-testid={TestIds.terminalNewLocal}>
                <Monitor />
                This device
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleSpawnRemote}
            aria-label="New terminal"
            data-testid={TestIds.terminalNew}
            disabled={!project}
          >
            <Plus />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={closePanel}
          aria-label="Close terminal panel"
          title="Close terminal panel"
        >
          <PanelBottomClose />
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        {activeSession ? (
          <TerminalView key={activeSession.id} sessionId={activeSession.id} />
        ) : (
          <div className="flex h-full items-center justify-center px-3 text-center">
            <div>
              <p className="text-xs font-medium text-foreground">No terminals</p>
              <p className="mt-1 text-xs text-muted-foreground">Add one with +.</p>
            </div>
          </div>
        )}
      </div>
      {renaming && (
        <TerminalRenameDialog
          key={renaming.id}
          initialName={renaming.name}
          onRename={(name: string): void => handleRename(renaming.id, name)}
          onClose={() => setRenaming(null)}
        />
      )}
      {mappingMode && project && (
        <LocalPathDialog
          key={`${mappingMode}:${mappedLocalPath ?? ''}`}
          repoPath={project.path}
          initialPath={mappedLocalPath ?? null}
          mode={mappingMode}
          onSaved={(localPath: string): void => {
            if (mappingMode === 'spawn') {
              runUserAction(
                () => spawnLocalTerminal(localPath),
                (error) => {
                  toastUserActionError('Open local terminal', error)
                },
              )
            }
          }}
          onClose={() => setMappingMode(null)}
        />
      )}
    </div>
  )
}
