import type {
  AgentEvent,
  AgentImage,
  AgentInteraction,
  AgentMode,
  AgentProvider,
  ApprovalDecision,
  ProviderLimits,
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

/** One custom slash command a driver's CLI exposes (from its `.md` command/prompt files). */
export interface AgentCommand {
  name: string
  description?: string
}

export interface AgentDriver {
  provider: AgentProvider
  status(): Promise<ProviderStatus>
  startTurn(opts: StartTurnOptions): TurnHandle
  /**
   * Generate a short LLM title for a thread from its first user message. Optional — a
   * driver returns `null` (or omits the hook) when it has no cheap one-shot path, and the
   * manager keeps the derived title. Implementations own their own timeout; they must
   * resolve (never hang) and never throw a rejection the manager can't swallow.
   */
  generateTitle?(opts: { repoPath: string; text: string }): Promise<string | null>
  /**
   * List the custom slash commands the CLI would expand, scanned from its command/prompt
   * `.md` files (repo-local + user-global). Optional — absent = no commands. Read-only.
   */
  listCommands?(repoPath: string): Promise<AgentCommand[]>
  /**
   * The provider's live quota windows + plan (Codex's rate-limit snapshot, Claude's OAuth
   * `/usage`). Optional — OpenCode has no limits API and omits it. Returns null when limits
   * are unavailable (not subscription-authed, the probe failed, …) rather than throwing;
   * the manager and api layer treat a throw as null too. Only DERIVED percentages/labels
   * are returned — an implementation must never surface a provider auth token here.
   */
  limits?(): Promise<ProviderLimits | null>
}

export type DriverRegistry = Record<AgentProvider, AgentDriver>
