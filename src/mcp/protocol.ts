// Minimal MCP (Model Context Protocol) over stdio: newline-delimited JSON-RPC 2.0.
// Hand-rolled rather than pulling the MCP SDK, so the standalone server stays
// DEPENDENCY-FREE — a plain `node out/mcp/server.js` the user's agent spawns, with
// nothing to resolve from node_modules (which a non-Electron `node` can't read from
// inside app.asar). The protocol surface is tiny: initialize, tools/list, tools/call.

export const SERVER_INFO = { name: 'porcelain', version: '0.5.0' }
export const PROTOCOL_VERSION = '2025-06-18'

const REVIEW_FILE_SCHEMA = {
  type: 'object',
  properties: {
    path: { type: 'string', description: 'Repo-relative file path' },
    source: {
      type: 'string',
      enum: ['changed', 'context', 'shipped'],
      description:
        "Where the file sits relative to the change: 'shipped' (already landed, e.g. the server half), 'context' (unchanged but needed to follow the flow). Files in the working tree are detected as 'changed' automatically.",
    },
    note: {
      type: 'string',
      description:
        'A cross-file invariant the reviewer must check (e.g. "labels must match the service").',
    },
    layer: {
      type: 'string',
      description:
        'The flow-layer heading this file sits under IN THE FEATURE VIEW (e.g. "Store", "Routes"). Set it to place the file exactly where it belongs in the feature\'s flow — when any file has a layer, Porcelain renders the feature view by your declared layers and file order instead of the repo-wide regex layers (which still drive the Changes tab). Omit to fall back to the regex match. Order your files entry-point → data; that order is preserved within each layer.',
    },
  },
  required: ['path'],
} as const

const LAYER_SCHEMA = {
  type: 'object',
  properties: {
    label: { type: 'string', description: 'The group heading shown in Porcelain (e.g. "Hooks")' },
    pattern: {
      type: 'string',
      description:
        'A JavaScript regular expression tested against the repo-relative path. Conventions the defaults use: a folder match is `(^|/)(foo|bar)/`, an extension match is `\\.(yaml|toml)$`, a filename-suffix match is `\\.(test|spec)\\.[a-z]+$`.',
    },
  },
  required: ['label', 'pattern'],
} as const

export const TOOLS = [
  {
    name: 'set_feature_review',
    description:
      "Define the feature review for a repo: the full set of files that make up the feature being reviewed, including server/cross-seam files the diff alone never shows, each optionally annotated with the invariant to check. Replaces any existing review set for the repo. List the files in flow order (entry point → data) — Porcelain renders the feature view in the order you send them. Set each file's `layer` to control the grouping for THIS feature; when you do, your layers + order win over the repo-wide regex layers (use get/set_flow_layers only for the repo-wide Changes-tab grouping).",
    inputSchema: {
      type: 'object',
      properties: {
        repoPath: { type: 'string', description: 'Absolute path to the repository' },
        name: { type: 'string', description: 'A name for the feature (e.g. "Crew call-outs")' },
        files: { type: 'array', items: REVIEW_FILE_SCHEMA },
      },
      required: ['repoPath', 'files'],
    },
  },
  {
    name: 'add_review_files',
    description:
      'Add files to the existing feature review for a repo (creating one if none exists). Files with a path already present are replaced. Use while building a feature to grow the review incrementally.',
    inputSchema: {
      type: 'object',
      properties: {
        repoPath: { type: 'string', description: 'Absolute path to the repository' },
        files: { type: 'array', items: REVIEW_FILE_SCHEMA },
      },
      required: ['repoPath', 'files'],
    },
  },
  {
    name: 'clear_feature_review',
    description:
      'Remove the feature review for a repo. Porcelain falls back to the static baseline (changed files plus what they import).',
    inputSchema: {
      type: 'object',
      properties: {
        repoPath: { type: 'string', description: 'Absolute path to the repository' },
      },
      required: ['repoPath'],
    },
  },
  {
    name: 'get_feature_review',
    description:
      'Read back the current feature review for a repo: its name, file count, and every file with its declared source and note. Use it to verify what you pushed, make an idempotent update (read → modify → set), or recover the set after losing context. Returns the stored set as declared; Porcelain still auto-detects working-tree files as "changed" when it renders.',
    inputSchema: {
      type: 'object',
      properties: {
        repoPath: { type: 'string', description: 'Absolute path to the repository' },
      },
      required: ['repoPath'],
    },
  },
  {
    name: 'get_feature_view',
    description:
      "Read Porcelain's COMPUTED feature view for a repo: every file it renders, grouped in flow order, each tagged with its source — 'changed' (in the git diff), 'context' (unchanged but reached by import), or 'shipped' (cross-seam, agent-declared) — and its flow layer. This is the complement to get_feature_review: that echoes what you DECLARED, this shows what Porcelain MADE of it after folding in git status and the import baseline (so it includes context files you didn't list, and tells you which files are actually diffed). Use it to confirm your set rendered as intended and to see the whole feature, not just the diff.",
    inputSchema: {
      type: 'object',
      properties: {
        repoPath: { type: 'string', description: 'Absolute path to the repository' },
      },
      required: ['repoPath'],
    },
  },
  {
    name: 'get_review_comments',
    description:
      "Read the human reviewer's open comments for a repo: each is anchored to a file (and optionally a line range), shows the snippet it was attached to, and carries the reviewer's note plus an id. Each is also tagged with the file's feature-view status — changed (in the git diff), context, or shipped — so you can tell a comment on a diffed file from one on an unchanged context/cross-seam file. The reviewer writes these in Porcelain by selecting lines or a file and adding a comment — use them as concrete review context (what to explain, fix, or look at). Resolve each with resolve_review_comment once you've addressed it.",
    inputSchema: {
      type: 'object',
      properties: {
        repoPath: { type: 'string', description: 'Absolute path to the repository' },
      },
      required: ['repoPath'],
    },
  },
  {
    name: 'resolve_review_comment',
    description:
      "Mark one of the reviewer's comments resolved, by its id (from get_review_comments), once you've addressed it. It then drops off the reviewer's open list in Porcelain. Only do this after actually handling the note.",
    inputSchema: {
      type: 'object',
      properties: {
        repoPath: { type: 'string', description: 'Absolute path to the repository' },
        id: { type: 'string', description: 'The comment id from get_review_comments' },
      },
      required: ['repoPath', 'id'],
    },
  },
  {
    name: 'get_reviewed_files',
    description:
      "Read which files the human has checked off as reviewed for a repo. Porcelain lets the reviewer mark each changed file reviewed (a per-file checkbox in the Changes / Feature lists); this returns those repo-relative paths. Use it to see how far the human has gotten and where to focus — any changed file NOT in this list is still unreviewed, so explain or double-check those, and treat reviewed ones as already vetted. The marks describe the current working tree and reset when the changes are committed. Read-only: the marks are the human's review state, so there is no tool to set them.",
    inputSchema: {
      type: 'object',
      properties: {
        repoPath: { type: 'string', description: 'Absolute path to the repository' },
      },
      required: ['repoPath'],
    },
  },
  {
    name: 'list_cards',
    description:
      'Read the project board for a repo: todo/doing/done cards the human (and you) use to plan the work, grouped by column, each with an id, title, and optional body. Read this to learn what to build next instead of waiting for the human to spell it out, and to keep the board in sync as you work.',
    inputSchema: {
      type: 'object',
      properties: {
        repoPath: { type: 'string', description: 'Absolute path to the repository' },
      },
      required: ['repoPath'],
    },
  },
  {
    name: 'create_card',
    description:
      'Add a card to the project board (defaults to the "todo" column). Use it to capture a task or feature you or the human identified.',
    inputSchema: {
      type: 'object',
      properties: {
        repoPath: { type: 'string', description: 'Absolute path to the repository' },
        title: { type: 'string', description: 'Short card title' },
        body: { type: 'string', description: 'Optional details / description' },
        status: {
          type: 'string',
          enum: ['todo', 'doing', 'done'],
          description: 'Column; defaults to todo',
        },
      },
      required: ['repoPath', 'title'],
    },
  },
  {
    name: 'update_card',
    description: "Edit a card's title and/or body, by its id (from list_cards).",
    inputSchema: {
      type: 'object',
      properties: {
        repoPath: { type: 'string', description: 'Absolute path to the repository' },
        id: { type: 'string', description: 'The card id from list_cards' },
        title: { type: 'string' },
        body: { type: 'string' },
      },
      required: ['repoPath', 'id'],
    },
  },
  {
    name: 'move_card',
    description:
      'Move a card to a different column, by its id. Move a card to "doing" when you start it and "done" when you finish, so the board reflects your progress.',
    inputSchema: {
      type: 'object',
      properties: {
        repoPath: { type: 'string', description: 'Absolute path to the repository' },
        id: { type: 'string', description: 'The card id from list_cards' },
        status: { type: 'string', enum: ['todo', 'doing', 'done'], description: 'Target column' },
      },
      required: ['repoPath', 'id', 'status'],
    },
  },
  {
    name: 'delete_card',
    description: 'Remove a card from the project board, by its id.',
    inputSchema: {
      type: 'object',
      properties: {
        repoPath: { type: 'string', description: 'Absolute path to the repository' },
        id: { type: 'string', description: 'The card id from list_cards' },
      },
      required: ['repoPath', 'id'],
    },
  },
  {
    name: 'list_actions',
    description:
      "Read the repo's saved actions: named shell commands the human runs in Porcelain's embedded terminal with one click (e.g. a dev server, storybook, a test watcher), each with an id, title, command, and optional cwd. Read this to see what's already set up, then curate it with create/update/delete_action. Note: only the human executes an action — there is no run tool.",
    inputSchema: {
      type: 'object',
      properties: {
        repoPath: { type: 'string', description: 'Absolute path to the repository' },
      },
      required: ['repoPath'],
    },
  },
  {
    name: 'create_action',
    description:
      "Add a saved action for the repo: a named command the human can run in Porcelain's embedded terminal. Use it to set up the project's common commands (dev server, storybook, lint, tests) so they're one click away. The human runs it; you only define it.",
    inputSchema: {
      type: 'object',
      properties: {
        repoPath: { type: 'string', description: 'Absolute path to the repository' },
        title: {
          type: 'string',
          description: 'Short label shown on the action (e.g. "Storybook")',
        },
        command: {
          type: 'string',
          description: 'The shell command to run (e.g. "pnpm --filter web dev")',
        },
        cwd: {
          type: 'string',
          description:
            'Optional working directory, repo-relative or absolute; defaults to repo root',
        },
      },
      required: ['repoPath', 'title', 'command'],
    },
  },
  {
    name: 'update_action',
    description: "Edit a saved action's title, command, and/or cwd, by its id (from list_actions).",
    inputSchema: {
      type: 'object',
      properties: {
        repoPath: { type: 'string', description: 'Absolute path to the repository' },
        id: { type: 'string', description: 'The action id from list_actions' },
        title: { type: 'string' },
        command: { type: 'string' },
        cwd: { type: 'string', description: 'Pass an empty string to clear the cwd' },
      },
      required: ['repoPath', 'id'],
    },
  },
  {
    name: 'delete_action',
    description: 'Remove a saved action from the repo, by its id (from list_actions).',
    inputSchema: {
      type: 'object',
      properties: {
        repoPath: { type: 'string', description: 'Absolute path to the repository' },
        id: { type: 'string', description: 'The action id from list_actions' },
      },
      required: ['repoPath', 'id'],
    },
  },
  {
    name: 'get_repo_notes',
    description:
      "Read the human's freeform project notes for a repo: a per-repo markdown scratchpad they keep in Porcelain (Files → Notes) with conventions, gotchas, todos, and context for the work. Read it to pick up project context the human jotted down instead of spelling it out in chat — especially when they mention \"my notes\" or you're starting work in the repo. Read-only: the notes are the human's, so there is no write tool (capture tasks on the project board instead).",
    inputSchema: {
      type: 'object',
      properties: {
        repoPath: { type: 'string', description: 'Absolute path to the repository' },
      },
      required: ['repoPath'],
    },
  },
  {
    name: 'get_flow_layers',
    description:
      'Read the repo\'s review-flow layers: the ordered { label, pattern } rules Porcelain uses to group changed files into a story from entry point to data. Returns the effective set — the repo\'s custom layers if set, otherwise the built-in defaults — as both a numbered list and JSON. Read this before tailoring the grouping with set_flow_layers; a file belongs to the furthest-right matching layer and unmatched files fall into "Other".',
    inputSchema: {
      type: 'object',
      properties: {
        repoPath: { type: 'string', description: 'Absolute path to the repository' },
      },
      required: ['repoPath'],
    },
  },
  {
    name: 'set_flow_layers',
    description:
      "Replace the repo's review-flow layers with a full ordered list (entry point → data), tailored to this codebase's actual structure. Send the COMPLETE desired set every time — this is a whole-set replace, so to add, edit, remove, or reorder a layer you send the new full list (read get_flow_layers first, modify, then set). Order matters twice: it is the order groups render in, and the furthest-right match on a path wins. Patterns are JavaScript regexes tested against repo-relative paths.",
    inputSchema: {
      type: 'object',
      properties: {
        repoPath: { type: 'string', description: 'Absolute path to the repository' },
        layers: {
          type: 'array',
          items: LAYER_SCHEMA,
          description: 'The full ordered layer set, entry point → data (at least one)',
        },
      },
      required: ['repoPath', 'layers'],
    },
  },
  {
    name: 'reset_flow_layers',
    description:
      "Remove the repo's custom review-flow layers so Porcelain falls back to its built-in defaults.",
    inputSchema: {
      type: 'object',
      properties: {
        repoPath: { type: 'string', description: 'Absolute path to the repository' },
      },
      required: ['repoPath'],
    },
  },
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function ok(id: unknown, result: Record<string, unknown>): Record<string, unknown> {
  return { jsonrpc: '2.0', id, result }
}

function fail(id: unknown, code: number, message: string): Record<string, unknown> {
  return { jsonrpc: '2.0', id, error: { code, message } }
}

/**
 * Handle one parsed JSON-RPC message. Returns the response object to write back,
 * or null for notifications (and unknown methods without an id) which get no reply.
 * `callTool` runs the side effect; a thrown error becomes an MCP tool error result
 * (isError) rather than a transport error, which is what clients expect.
 */
export async function handleRpc(
  message: unknown,
  callTool: (name: string, args: Record<string, unknown>) => Promise<string>,
): Promise<Record<string, unknown> | null> {
  if (!isRecord(message)) return null
  const method = asString(message.method)
  const id = message.id
  if (method === undefined) return null
  const isNotification = !('id' in message) || id === null || id === undefined
  // Notifications get no reply and must not execute any side effect. JSON-RPC 2.0:
  // a message without an id is a notification; the server MUST NOT return a response.
  // MCP always sends tools/call as a request (with an id), so no legitimate traffic
  // is lost here. Moving the guard above dispatch also prevents double-execution if
  // a client retries a notification-shaped tools/call.
  if (isNotification) return null

  if (method === 'initialize') {
    const params = isRecord(message.params) ? message.params : {}
    return ok(id, {
      protocolVersion: asString(params.protocolVersion) ?? PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO,
    })
  }
  if (method === 'tools/list') return ok(id, { tools: TOOLS })
  if (method === 'ping') return ok(id, {})
  if (method === 'tools/call') {
    const params = isRecord(message.params) ? message.params : {}
    const name = asString(params.name)
    const args = isRecord(params.arguments) ? params.arguments : {}
    if (name === undefined) return fail(id, -32602, 'missing tool name')
    try {
      const text = await callTool(name, args)
      return ok(id, { content: [{ type: 'text', text }] })
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error)
      return ok(id, { content: [{ type: 'text', text }], isError: true })
    }
  }
  return fail(id, -32601, `method not found: ${method}`)
}
