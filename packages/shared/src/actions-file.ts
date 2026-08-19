/**
 * Strict version-1 Actions file model — shared by the daemon adapter and the dependency-free CLI.
 * No Zod, no Node APIs: pure parse, serialize, and action transitions.
 */

export const ACTIONS_FILE_VERSION = 1 as const
export const ACTIONS_FILE_MAX_BYTES = 512 * 1024
export const ACTION_TITLE_MAX_LENGTH = 240
export const ACTION_COMMAND_MAX_LENGTH = 20_000

export type ActionsFileWhere = 'primary' | 'local'

/**
 * What the row is for. `action` is the human's one-click command; the worktree roles are
 * lifecycle scripts Porcelain runs itself. Stored in the same document because the trust
 * gate, ordering, and Project ownership are identical — only who presses go differs.
 *
 * Absent means `action`, and `action` is never written back, so a document produced before
 * this field round-trips byte-identical.
 */
export type ActionsFileKind = 'action' | 'worktree-setup' | 'worktree-dispose'

export type ActionsFileAction = {
  id: string
  title: string
  command: string
  where?: ActionsFileWhere
  kind?: Exclude<ActionsFileKind, 'action'>
  order: number
  createdAt: number
}

/** The role a row plays, with the on-disk default applied. */
export function actionKindOf(action: Pick<ActionsFileAction, 'kind'>): ActionsFileKind {
  return action.kind ?? 'action'
}

export type ActionsFileV1 = {
  version: typeof ACTIONS_FILE_VERSION
  actions: ActionsFileAction[]
}

export type ActionsFileParseErrorCode =
  | 'incompatible-version'
  | 'malformed'
  | 'duplicate-id'
  | 'invalid-action'

export class ActionsFileParseError extends Error {
  readonly code: ActionsFileParseErrorCode

  constructor(code: ActionsFileParseErrorCode, message: string) {
    super(message)
    this.name = 'ActionsFileParseError'
    this.code = code
  }
}

export type ActionsNotFoundError = {
  code: 'actions.not-found'
  actionId: string
}

export type ActionsRequestInvalidError = {
  code: 'request.invalid'
}

const WHERE_SET = new Set<string>(['primary', 'local'])
const KIND_SET = new Set<string>(['action', 'worktree-setup', 'worktree-dispose'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSafeNonNegativeInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function normalizeRequiredText(
  value: string,
  maxLength: number,
): { ok: true; text: string } | { ok: false; error: ActionsRequestInvalidError } {
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > maxLength) {
    return { ok: false, error: { code: 'request.invalid' } }
  }
  return { ok: true, text: trimmed }
}

export function emptyActionsFileV1(): ActionsFileV1 {
  return { version: ACTIONS_FILE_VERSION, actions: [] }
}

function parseAction(value: unknown, index: number): ActionsFileAction {
  if (!isRecord(value)) {
    throw new ActionsFileParseError('invalid-action', `actions[${index}] is not an object`)
  }
  for (const key of Object.keys(value)) {
    if (
      key !== 'id' &&
      key !== 'title' &&
      key !== 'command' &&
      key !== 'where' &&
      key !== 'kind' &&
      key !== 'order' &&
      key !== 'createdAt'
    ) {
      throw new ActionsFileParseError(
        'invalid-action',
        `actions[${index}] has unknown field ${key}`,
      )
    }
  }
  if (typeof value.id !== 'string' || value.id.length === 0) {
    throw new ActionsFileParseError('invalid-action', `actions[${index}].id is invalid`)
  }
  if (typeof value.title !== 'string') {
    throw new ActionsFileParseError('invalid-action', `actions[${index}].title is not a string`)
  }
  const title = normalizeRequiredText(value.title, ACTION_TITLE_MAX_LENGTH)
  if (!title.ok) {
    throw new ActionsFileParseError('invalid-action', `actions[${index}].title is invalid`)
  }
  if (typeof value.command !== 'string') {
    throw new ActionsFileParseError('invalid-action', `actions[${index}].command is not a string`)
  }
  const command = normalizeRequiredText(value.command, ACTION_COMMAND_MAX_LENGTH)
  if (!command.ok) {
    throw new ActionsFileParseError('invalid-action', `actions[${index}].command is invalid`)
  }
  if (!isSafeNonNegativeInt(value.order)) {
    throw new ActionsFileParseError('invalid-action', `actions[${index}].order is invalid`)
  }
  if (!isSafeNonNegativeInt(value.createdAt)) {
    throw new ActionsFileParseError('invalid-action', `actions[${index}].createdAt is invalid`)
  }
  if (value.where !== undefined) {
    if (typeof value.where !== 'string' || !WHERE_SET.has(value.where)) {
      throw new ActionsFileParseError('invalid-action', `actions[${index}].where is invalid`)
    }
  }
  if (value.kind !== undefined) {
    if (typeof value.kind !== 'string' || !KIND_SET.has(value.kind)) {
      throw new ActionsFileParseError('invalid-action', `actions[${index}].kind is invalid`)
    }
  }

  const action: ActionsFileAction = {
    id: value.id,
    title: title.text,
    command: command.text,
    order: value.order,
    createdAt: value.createdAt,
  }
  // Never persist primary on disk; treat an explicit primary as omitted.
  if (value.where === 'local') action.where = 'local'
  // Same rule for the default role: a plain action carries no kind.
  if (value.kind === 'worktree-setup' || value.kind === 'worktree-dispose') action.kind = value.kind
  return action
}

/** Parse an untrusted Actions document. Throws {@link ActionsFileParseError} on any violation. */
export function parseActionsFileV1(value: unknown): ActionsFileV1 {
  if (Array.isArray(value)) {
    throw new ActionsFileParseError(
      'malformed',
      'Actions file must be version 1 ({ version: 1, actions: [...] }); top-level arrays are not supported',
    )
  }
  if (!isRecord(value)) {
    throw new ActionsFileParseError('malformed', 'Actions file must be a JSON object')
  }
  for (const key of Object.keys(value)) {
    if (key !== 'version' && key !== 'actions') {
      throw new ActionsFileParseError('malformed', `unknown field ${key}`)
    }
  }
  if (
    !('version' in value) ||
    typeof value.version !== 'number' ||
    !Number.isFinite(value.version)
  ) {
    throw new ActionsFileParseError('malformed', 'version is required')
  }
  if (value.version !== ACTIONS_FILE_VERSION) {
    throw new ActionsFileParseError(
      'incompatible-version',
      `unsupported Actions file version ${String(value.version)}`,
    )
  }
  if (!Array.isArray(value.actions)) {
    throw new ActionsFileParseError('malformed', 'actions must be an array')
  }

  const actions: ActionsFileAction[] = []
  const seen = new Set<string>()
  for (let index = 0; index < value.actions.length; index += 1) {
    const action = parseAction(value.actions[index], index)
    if (seen.has(action.id)) {
      throw new ActionsFileParseError('duplicate-id', `duplicate action id ${action.id}`)
    }
    seen.add(action.id)
    actions.push(action)
  }
  return { version: ACTIONS_FILE_VERSION, actions }
}

export function serializeActionsFileV1(value: ActionsFileV1): string {
  const valid = parseActionsFileV1(value)
  return `${JSON.stringify(valid, null, 2)}\n`
}

/** Deterministic list order: order, then createdAt, then id. */
export function sortActions(actions: readonly ActionsFileAction[]): ActionsFileAction[] {
  return [...actions].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order
    if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt
    if (a.id < b.id) return -1
    if (a.id > b.id) return 1
    return 0
  })
}

function cloneAction(action: ActionsFileAction): ActionsFileAction {
  const next: ActionsFileAction = {
    id: action.id,
    title: action.title,
    command: action.command,
    order: action.order,
    createdAt: action.createdAt,
  }
  if (action.where !== undefined) next.where = action.where
  if (action.kind !== undefined) next.kind = action.kind
  return next
}

function withActions(_file: ActionsFileV1, actions: ActionsFileAction[]): ActionsFileV1 {
  return { version: ACTIONS_FILE_VERSION, actions }
}

export function planCreateAction(
  file: ActionsFileV1,
  input: {
    id: string
    title: string
    command: string
    where?: ActionsFileWhere
    kind?: ActionsFileKind
    order: number
    createdAt: number
  },
):
  | { ok: true; file: ActionsFileV1; action: ActionsFileAction }
  | { ok: false; error: ActionsRequestInvalidError } {
  const title = normalizeRequiredText(input.title, ACTION_TITLE_MAX_LENGTH)
  if (!title.ok) return title
  const command = normalizeRequiredText(input.command, ACTION_COMMAND_MAX_LENGTH)
  if (!command.ok) return command
  if (input.id.length === 0) {
    return { ok: false, error: { code: 'request.invalid' } }
  }

  const action: ActionsFileAction = {
    id: input.id,
    title: title.text,
    command: command.text,
    order: input.order,
    createdAt: input.createdAt,
  }
  if (input.where === 'local') action.where = 'local'
  if (input.kind === 'worktree-setup' || input.kind === 'worktree-dispose') action.kind = input.kind

  return {
    ok: true,
    file: withActions(file, [...file.actions.map(cloneAction), action]),
    action,
  }
}

export function planUpdateAction(
  file: ActionsFileV1,
  input: {
    actionId: string
    title?: string
    command?: string
    where?: ActionsFileWhere
  },
):
  | { ok: true; file: ActionsFileV1; action: ActionsFileAction }
  | { ok: false; error: ActionsNotFoundError | ActionsRequestInvalidError } {
  const index = file.actions.findIndex((action) => action.id === input.actionId)
  if (index < 0) {
    return { ok: false, error: { code: 'actions.not-found', actionId: input.actionId } }
  }
  const current = file.actions[index]
  if (current === undefined) {
    return { ok: false, error: { code: 'actions.not-found', actionId: input.actionId } }
  }

  let title = current.title
  if (input.title !== undefined) {
    const normalized = normalizeRequiredText(input.title, ACTION_TITLE_MAX_LENGTH)
    if (!normalized.ok) return normalized
    title = normalized.text
  }

  let command = current.command
  if (input.command !== undefined) {
    const normalized = normalizeRequiredText(input.command, ACTION_COMMAND_MAX_LENGTH)
    if (!normalized.ok) return normalized
    command = normalized.text
  }

  const action = cloneAction(current)
  action.title = title
  action.command = command
  if (input.where !== undefined) {
    if (input.where === 'primary') delete action.where
    else action.where = 'local'
  }

  const actions = file.actions.map(cloneAction)
  actions[index] = action
  return { ok: true, file: withActions(file, actions), action }
}

export function planMoveAction(
  file: ActionsFileV1,
  input: { actionId: string; direction: 'up' | 'down' },
):
  | { ok: true; kind: 'move'; file: ActionsFileV1; action: ActionsFileAction }
  | { ok: true; kind: 'noop'; file: ActionsFileV1; action: ActionsFileAction }
  | { ok: false; error: ActionsNotFoundError } {
  const moved = file.actions.find((action) => action.id === input.actionId)
  if (moved === undefined) {
    return { ok: false, error: { code: 'actions.not-found', actionId: input.actionId } }
  }
  // Reorder within the moved row's own role. The human sees one kind per list, so a
  // neighbour of another kind is invisible to them: swapping with it would move the row
  // nowhere on screen and quietly shuffle a list they never opened.
  const sorted = sortActions(file.actions).filter(
    (action) => actionKindOf(action) === actionKindOf(moved),
  )
  const index = sorted.findIndex((action) => action.id === input.actionId)
  const current = index < 0 ? undefined : sorted[index]
  if (current === undefined) {
    return { ok: false, error: { code: 'actions.not-found', actionId: input.actionId } }
  }

  const target = index + (input.direction === 'up' ? -1 : 1)
  if (target < 0 || target >= sorted.length) {
    return {
      ok: true,
      kind: 'noop',
      file: withActions(file, file.actions.map(cloneAction)),
      action: cloneAction(current),
    }
  }

  const neighbour = sorted[target]
  if (neighbour === undefined) {
    return {
      ok: true,
      kind: 'noop',
      file: withActions(file, file.actions.map(cloneAction)),
      action: cloneAction(current),
    }
  }

  const nextCurrent = cloneAction(current)
  const nextNeighbour = cloneAction(neighbour)
  const tmp = nextCurrent.order
  nextCurrent.order = nextNeighbour.order
  nextNeighbour.order = tmp

  const byId = new Map(file.actions.map((action) => [action.id, cloneAction(action)]))
  byId.set(nextCurrent.id, nextCurrent)
  byId.set(nextNeighbour.id, nextNeighbour)
  const actions = file.actions.map((action) => byId.get(action.id) ?? cloneAction(action))

  return {
    ok: true,
    kind: 'move',
    file: withActions(file, actions),
    action: nextCurrent,
  }
}

export function planDeleteAction(
  file: ActionsFileV1,
  input: { actionId: string },
):
  | { ok: true; file: ActionsFileV1; actionId: string }
  | { ok: false; error: ActionsNotFoundError } {
  if (!file.actions.some((action) => action.id === input.actionId)) {
    return { ok: false, error: { code: 'actions.not-found', actionId: input.actionId } }
  }
  return {
    ok: true,
    file: withActions(
      file,
      file.actions.filter((action) => action.id !== input.actionId).map(cloneAction),
    ),
    actionId: input.actionId,
  }
}
