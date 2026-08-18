/**
 * The tool surface an agent sees. Eight tools over the daemon's operations, not a
 * transliteration of the retired CLI's seventeen verbs: every tool definition is
 * spent from the agent's context window on every turn, so the surface is grouped by
 * intention (orient, declare, record, publish) rather than by noun and verb.
 *
 * Two of these reach channels the CLI never had. `comment-router` and
 * `review-marks-router` have been live on the daemon the whole time with nothing on
 * the agent side to call them, so an agent could not read the human's review
 * comments at all — in a review layer, that is the loop.
 */

export type McpToolDefinition = Readonly<{
  name: string
  title: string
  description: string
  inputSchema: Record<string, unknown>
}>

/**
 * Where to operate. A path is the ordinary local answer and costs the agent nothing —
 * it already knows its checkout. The explicit id form exists because a stateless
 * request carries no cwd and a *remote* daemon cannot resolve a path that only exists
 * on the agent's machine.
 */
const WORKSPACE = {
  description:
    'Which checkout to act on: an absolute path inside it (local daemon), or {projectId, worktreeId?} — required when the daemon runs on another host.',
  anyOf: [
    { type: 'string', description: 'Absolute path inside the checkout' },
    {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        worktreeId: { type: 'string' },
      },
      required: ['projectId'],
      additionalProperties: false,
    },
  ],
} as const

const REVIEW_FILE = {
  type: 'object',
  properties: {
    path: { type: 'string', description: 'Repo-relative path' },
    source: { enum: ['changed', 'context', 'shipped'] },
    note: { type: 'string', description: 'Why this file is in the Review' },
    layer: { type: 'string', description: 'Grouping label, e.g. "wire" or "daemon"' },
  },
  required: ['path'],
  additionalProperties: false,
} as const

const REVIEW_SECTION = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    prose: { type: 'string', description: 'Markdown' },
    diagram: { type: 'string', description: 'Inline SVG' },
    anchors: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          startLine: { type: 'integer' },
          endLine: { type: 'integer' },
        },
        required: ['path'],
        additionalProperties: false,
      },
    },
  },
  required: ['title', 'prose'],
  additionalProperties: false,
} as const

const PROFILE_LAYER = {
  type: 'object',
  properties: { label: { type: 'string' }, pattern: { type: 'string' } },
  required: ['label', 'pattern'],
  additionalProperties: false,
} as const

const PROFILE_FIELDS = {
  pinnedPaths: { type: 'array', items: { type: 'string' } },
  hiddenPaths: { type: 'array', items: { type: 'string' } },
} as const

export const MCP_TOOLS: readonly McpToolDefinition[] = Object.freeze([
  {
    name: 'porcelain_context',
    title: 'Read the workspace',
    description:
      "Read the current state of a Porcelain workspace: the Review, the human's review comments, the files they have marked reviewed, Tasks, saved Actions, and Canvases. Call this first — it resolves the workspace and returns what is needed to orient. Defaults to the Review, comments and marks; ask for tasks/actions/canvases only when the work needs them.",
    inputSchema: {
      type: 'object',
      properties: {
        workspace: WORKSPACE,
        include: {
          type: 'array',
          items: { enum: ['review', 'comments', 'marks', 'tasks', 'actions', 'canvases'] },
          description: 'Sections to return. Default: review, comments, marks.',
        },
        taskId: {
          type: 'string',
          description: 'Return only this Task (UUID or short id, e.g. T-18)',
        },
      },
      required: ['workspace'],
      additionalProperties: false,
    },
  },
  {
    name: 'porcelain_profile',
    title: 'Read or set the profile',
    description:
      'Read or replace the private project profile or this worktree override. Reads before writes; set replaces the selected level as a whole. Clear removes the selected level.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace: WORKSPACE,
        level: { enum: ['project', 'worktree'] },
        op: { enum: ['get', 'set', 'clear'] },
        profile: {
          oneOf: [
            {
              type: 'object',
              properties: {
                ...PROFILE_FIELDS,
                layers: { type: 'array', items: PROFILE_LAYER },
              },
              required: ['pinnedPaths', 'hiddenPaths', 'layers'],
              additionalProperties: false,
              description: 'Project profile',
            },
            {
              type: 'object',
              properties: {
                ...PROFILE_FIELDS,
                unhiddenPaths: { type: 'array', items: { type: 'string' } },
                layers: { type: ['array', 'null'], items: PROFILE_LAYER },
              },
              required: ['pinnedPaths', 'hiddenPaths', 'unhiddenPaths', 'layers'],
              additionalProperties: false,
              description: 'Worktree override',
            },
          ],
          description: 'Required for set.',
        },
      },
      required: ['workspace', 'level', 'op'],
      additionalProperties: false,
    },
  },
  {
    name: 'porcelain_review',
    title: 'Declare the Review',
    description:
      'Declare what this change is and which files carry it. "replace" writes the whole Review; a name and thesis alone is a valid Intent-first start, before any file is listed. "append" adds files to the Review that exists. "clear" removes it.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace: WORKSPACE,
        mode: { enum: ['replace', 'append', 'clear'] },
        name: { type: 'string', description: 'Review name shown in Porcelain' },
        thesis: { type: 'string', description: 'One-paragraph markdown thesis' },
        files: {
          type: 'array',
          items: REVIEW_FILE,
          description: 'In flow order: entry point → data',
        },
        sections: {
          type: 'array',
          items: REVIEW_SECTION,
          description: 'Walkthrough, in flow order',
        },
      },
      required: ['workspace', 'mode'],
      additionalProperties: false,
    },
  },
  {
    name: 'porcelain_task',
    title: 'Record a Task',
    description:
      'Create or update a Task on the daemon-wide board — work that spans or outlives this checkout. Omit "id" to create; pass it to update. Tasks are read through porcelain_context.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace: WORKSPACE,
        id: { type: 'string', description: 'Omit to create a new Task' },
        title: { type: 'string' },
        notes: { type: 'string', description: 'Markdown' },
        status: { enum: ['todo', 'doing', 'done', 'blocked'] },
        tags: { type: 'array', items: { type: 'string' } },
        link: { type: 'string', description: 'An http(s) URL to attach' },
        linkLabel: { type: 'string' },
        attach: {
          type: 'string',
          description:
            "Absolute path to a file copied into the daemon's attachment store. Local daemon only — the path is read on the daemon host.",
        },
        file: { type: 'string', description: 'Worktree-relative file to tag (not copied)' },
        folder: { type: 'string', description: 'Worktree-relative folder to tag (not copied)' },
      },
      required: ['workspace'],
      additionalProperties: false,
    },
  },
  {
    name: 'porcelain_action',
    title: 'Save an Action',
    description:
      'Define or remove a saved Action — a named shell command the HUMAN runs from the app. Porcelain never runs it for you. An Action you create arrives untrusted and the human approves the command text before it can run.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace: WORKSPACE,
        op: { enum: ['save', 'delete'] },
        id: { type: 'string', description: 'Omit on save to create a new Action' },
        title: { type: 'string' },
        command: { type: 'string', description: 'The shell command the human will run' },
        where: {
          enum: ['primary', 'local'],
          description: "Where the human's click runs it: the window's machine, or their device",
        },
      },
      required: ['workspace', 'op'],
      additionalProperties: false,
    },
  },
  {
    name: 'porcelain_canvas',
    title: 'Publish a Canvas',
    description:
      'Publish an agent-authored explanation for this Project from a local directory of files (entry file plus its images, CSS, JS). Omit "id" to create, pass it to replace. Local daemon only — the directory is read on the daemon host.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace: WORKSPACE,
        id: { type: 'string', description: 'Omit to create a new Canvas' },
        title: { type: 'string' },
        kind: { enum: ['html', 'markdown'] },
        sourceDir: { type: 'string', description: 'Absolute path to the directory to copy in' },
        entry: {
          type: 'string',
          description: 'Entry file inside sourceDir (default index.html / index.md)',
        },
        tracked: {
          type: 'boolean',
          description:
            'Write to the tracked <repo>/.porcelain/ overlay instead of the private store',
        },
      },
      required: ['workspace', 'title', 'kind', 'sourceDir'],
      additionalProperties: false,
    },
  },
  {
    name: 'porcelain_promote',
    title: 'Promote into the checkout',
    description:
      'Move private daemon-root data into the checkout as tracked files so Git carries it. Writes files; never stages and never commits.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace: WORKSPACE,
        what: { enum: ['canvas', 'overrides'] },
        canvasId: { type: 'string', description: 'Required when what = canvas' },
        target: { type: 'string', description: 'Absolute path of the checkout to write into' },
      },
      required: ['workspace', 'what'],
      additionalProperties: false,
    },
  },
  {
    name: 'porcelain_reply',
    title: 'Answer a review comment',
    description:
      'Reply to a comment the human left on the Review. Read the open comments with porcelain_context first. You cannot resolve or delete a comment — the human closes their own loop.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace: WORKSPACE,
        commentId: { type: 'string' },
        body: { type: 'string', description: 'Markdown reply' },
      },
      required: ['workspace', 'commentId', 'body'],
      additionalProperties: false,
    },
  },
])

export const MCP_TOOL_NAMES: readonly string[] = MCP_TOOLS.map((tool) => tool.name)
