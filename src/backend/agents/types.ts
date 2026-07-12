import type {
  AgentEvent,
  AgentImage,
  AgentInteraction,
  AgentMode,
  AgentProvider,
  ApprovalDecision,
  ProviderStatus,
} from '../../shared/agent-protocol'

/**
 * A driver is the daemon's adapter for one coding-agent CLI (Claude Code, Codex,
 * OpenCode). It probes the installed CLI's status and runs a single turn, translating
 * that CLI's native output into normalized `AgentEvent`s. Drivers are Electron-free
 * and own NO persistence, roster, or fan-out — the agent-manager does all of that; a
 * driver only speaks its CLI's protocol.
 */

/** A live handle on the running turn — the manager's only levers once it's started. */
export interface TurnHandle {
  /** Interrupt the turn (the driver stops the CLI; it may still emit a final event). */
  abort(): void
  /** Answer a pending approval the turn is blocked on (Claude's canUseTool, …). */
  respondApproval(requestId: string, decision: ApprovalDecision): void
}

export interface StartTurnOptions {
  repoPath: string
  model: string
  mode: AgentMode
  /**
   * The Build/Plan interaction mode, mapped per-driver onto each CLI's own plan
   * mechanism (Claude's `plan` permission-mode, Codex's collaborationMode, OpenCode's
   * built-in `plan` agent). The manager defaults an unset thread to 'build'.
   */
  interaction: AgentInteraction
  /**
   * The thread's chosen per-turn model options (reasoning effort + context window). Each
   * driver maps these onto its CLI (Claude's `--effort` / `[1m]` id suffix, Codex's
   * `turn/start.effort`, OpenCode's prompt `variant`) and ignores any it doesn't support.
   * Always present (the manager passes `{}` for an untouched thread) so a driver never
   * has to null-check the container.
   */
  options: { effort?: string; contextWindow?: string }
  /**
   * The driver-private session state persisted on the thread (opaque to the manager —
   * a Claude session id, a Codex conversation handle, …), passed back so the CLI can
   * resume the conversation. `undefined` on the first turn.
   */
  resume: unknown
  text: string
  images: AgentImage[]
  /**
   * Emit a normalized event. MUST be called asynchronously — after `startTurn` returns
   * — so the manager has recorded the returned handle before any event (or `onDone`)
   * arrives. Real drivers spawn a process, so this is naturally satisfied.
   */
  emit(event: AgentEvent): void
  /** Report new driver-private session state to persist on the thread. */
  onSessionState(state: unknown): void
  /** Signal the turn ended (success or failure); the manager clears the turn + status. */
  onDone(result: { ok: boolean }): void
}

export interface AgentDriver {
  provider: AgentProvider
  status(): Promise<ProviderStatus>
  startTurn(opts: StartTurnOptions): TurnHandle
}

export type DriverRegistry = Record<AgentProvider, AgentDriver>
