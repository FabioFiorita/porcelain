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
    'Which checkout to act on. Normally the absolute path of the repository you are working in — your own working directory (process.cwd()) or any directory inside it works, e.g. "/home/me/code/app". Use {projectId, worktreeId?} to act on a DIFFERENT checkout than your own, or when the daemon runs on another host where your path means nothing; list the ids with porcelain_context include: ["projects"].',
  anyOf: [
    {
      type: 'string',
      description: 'Absolute path inside the checkout — your cwd or the repo root',
    },
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
      'Read Porcelain state: the Review, the human\'s open review comments, the files they marked reviewed, the Task board, saved Actions, Canvases, and the Projects this daemon has open. Call this FIRST — it resolves the workspace and is the only read you need; never read $PORCELAIN_HOME or call the daemon\'s HTTP API yourself. Examples: {workspace: "/home/me/code/app", include: ["tasks"]} lists every open Task with its short id (T-18), status, notes, links and attachment paths; add includeDone: true for finished ones; {include: ["tasks"], taskId: "T-18"} returns one Task, whose attachments carry an absolute hostPath you can read as a file when the daemon is this machine; {include: ["projects"]} lists the projectId/worktreeId of every checkout, for acting on one other than your own.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace: WORKSPACE,
        include: {
          type: 'array',
          items: {
            enum: ['review', 'comments', 'marks', 'tasks', 'actions', 'canvases', 'projects'],
          },
          description:
            'Sections to return. Default: review, comments, marks. "tasks" is the whole daemon-wide board; "projects" is every checkout this daemon has open, with its ids.',
        },
        taskId: {
          type: 'string',
          description: 'Return only this Task. Short id (T-18) or UUID.',
        },
        includeDone: {
          type: 'boolean',
          description: 'Include Tasks with status "done" in the listing. Default false.',
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
      'Read or replace the private project profile or this worktree override. Reads before writes; set replaces the selected level as a whole, so get first. Clear removes the selected level. pinnedPaths and hiddenPaths are EXACT repository-relative paths matched by set membership, not globs — "dist" hides that directory, "*.log" hides nothing.',
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
      'Create or update Tasks on the daemon-wide board — work that spans or outlives this checkout. Omit "id" to create. Pass "id" (short id like T-18, or UUID) to update one, or "ids" to apply the same change to several — e.g. {ids: ["T-3","T-4"], status: "done"}. A "link" is ADDED to the Task\'s existing links (attach a PR with {id: "T-18", status: "done", link: "https://github.com/o/r/pull/7", linkLabel: "PR #7"}); "links" replaces them all. Read Tasks back with porcelain_context include: ["tasks"]. If something you need is not possible here, that is a bug in this tool — record it as a Task rather than editing the daemon\'s files.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace: WORKSPACE,
        id: {
          type: 'string',
          description: 'Short id (T-18) or UUID of the Task to update. Omit to create a new one.',
        },
        ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Update several Tasks with the same change. Not for title.',
        },
        title: { type: 'string', description: 'Required when creating' },
        notes: { type: 'string', description: 'Markdown. Replaces the existing notes.' },
        status: { enum: ['todo', 'doing', 'done', 'blocked'] },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Replaces the existing tags',
        },
        link: {
          type: 'string',
          description: 'An http(s) URL ADDED to the Task, keeping the links already there',
        },
        linkLabel: { type: 'string', description: 'Label for "link". Defaults to the URL.' },
        links: {
          type: 'array',
          items: {
            type: 'object',
            properties: { url: { type: 'string' }, label: { type: 'string' } },
            required: ['url'],
            additionalProperties: false,
          },
          description: 'Replace every link on the Task. Use "link" to add one.',
        },
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
