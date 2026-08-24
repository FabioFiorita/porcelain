/**
 * The MCP surface is deliberately organized around Porcelain's product domains.
 * Each domain is one entry point and its `op` selects the small CRUD/read family
 * that belongs to it. Review is a Canvas template, replies are Comment operations,
 * and promotion is an operation on the thing being promoted.
 */

export type McpToolDefinition = Readonly<{
  name: string
  title: string
  description: string
  inputSchema: Record<string, unknown>
}>

/** Where to operate. A path is the ordinary local answer and costs the agent nothing. */
const WORKSPACE = {
  description:
    'Which checkout to act on. Normally the absolute path of the repository you are working in. Use {projectId, worktreeId?} to target a different checkout; discover ids with porcelain_project.',
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

const PROFILE_LAYER = {
  type: 'object',
  properties: { label: { type: 'string' }, pattern: { type: 'string' } },
  required: ['label', 'pattern'],
  additionalProperties: false,
} as const

const PROFILE = {
  oneOf: [
    {
      type: 'object',
      properties: {
        pinnedPaths: { type: 'array', items: { type: 'string' } },
        hiddenPaths: { type: 'array', items: { type: 'string' } },
        layers: { type: 'array', items: PROFILE_LAYER },
      },
      required: ['pinnedPaths', 'hiddenPaths', 'layers'],
      additionalProperties: false,
      description: 'Project profile',
    },
    {
      type: 'object',
      properties: {
        pinnedPaths: { type: 'array', items: { type: 'string' } },
        hiddenPaths: { type: 'array', items: { type: 'string' } },
        unhiddenPaths: { type: 'array', items: { type: 'string' } },
        layers: { type: ['array', 'null'], items: PROFILE_LAYER },
      },
      required: ['pinnedPaths', 'hiddenPaths', 'unhiddenPaths', 'layers'],
      additionalProperties: false,
      description: 'Worktree override',
    },
  ],
  description: 'Required for set; set replaces the selected level as a whole.',
} as const

const CANVAS_FILE = {
  type: 'object',
  properties: {
    path: { type: 'string', description: 'Bundle-relative path' },
    content: { type: 'string' },
  },
  required: ['path', 'content'],
  additionalProperties: false,
} as const

const REVIEW_FILE = {
  type: 'object',
  properties: {
    path: { type: 'string' },
    source: { enum: ['changed', 'context', 'shipped'] },
    note: { type: 'string' },
    layer: { type: 'string' },
  },
  required: ['path'],
  additionalProperties: false,
} as const

const REVIEW_SECTION = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    prose: { type: 'string', description: 'Markdown prose' },
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

const COMMENT = {
  type: 'object',
  properties: {
    path: { type: 'string', description: 'Repo-relative file path' },
    startLine: { type: 'integer' },
    endLine: { type: 'integer' },
    anchorText: { type: 'string' },
    body: { type: 'string', description: 'Markdown comment or reply' },
  },
  additionalProperties: false,
} as const

export const MCP_TOOLS: readonly McpToolDefinition[] = Object.freeze([
  {
    name: 'porcelain_project',
    title: 'Discover Projects and Worktrees',
    description:
      'List the Projects and Worktrees known by this daemon, or get one Project by id. Use this when targeting a checkout other than the current workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        op: { enum: ['list', 'get'] },
        workspace: WORKSPACE,
        projectId: { type: 'string' },
      },
      required: ['op'],
      additionalProperties: false,
    },
  },
  {
    name: 'porcelain_canvas',
    title: 'Manage a Canvas',
    description:
      'List, read, create, update, delete, or promote an agent-authored Canvas. Review is the `review` template inside Canvas; use templateData for its structured files and sections. A promoted Canvas is tracked in <repo>/.porcelain and becomes canonical for that checkout. Promotion writes files but never stages or commits.',
    inputSchema: {
      type: 'object',
      properties: {
        op: { enum: ['list', 'get', 'create', 'update', 'delete', 'promote'] },
        workspace: WORKSPACE,
        id: { type: 'string', description: 'Canvas id for get/update/delete/promote' },
        title: { type: 'string' },
        kind: { enum: ['html', 'markdown'] },
        sourceDir: { type: 'string', description: 'Absolute directory on the daemon host' },
        entry: { type: 'string', description: 'Bundle-relative entry file' },
        files: { type: 'array', items: CANVAS_FILE },
        tracked: {
          type: 'boolean',
          description: 'Create or update directly in the tracked checkout overlay',
        },
        template: { enum: ['review'] },
        templateData: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            thesis: { type: 'string' },
            files: { type: 'array', items: REVIEW_FILE },
            sections: { type: 'array', items: REVIEW_SECTION },
          },
          required: ['name', 'files', 'sections'],
          additionalProperties: false,
        },
      },
      required: ['op', 'workspace'],
      additionalProperties: false,
    },
  },
  {
    name: 'porcelain_comment',
    title: 'Manage Review Comments',
    description:
      'List, read, create, edit, delete, reply to, resolve, or reopen review comments. Use status open, resolved, or all when listing. Replies remain attached to their parent comment; resolve/reopen changes the parent status.',
    inputSchema: {
      type: 'object',
      properties: {
        op: { enum: ['list', 'get', 'create', 'update', 'delete', 'reply', 'resolve', 'reopen'] },
        workspace: WORKSPACE,
        id: {
          type: 'string',
          description: 'Comment id for get/update/delete/reply/resolve/reopen',
        },
        status: { enum: ['open', 'resolved', 'all'] },
        comment: COMMENT,
        body: { type: 'string', description: 'Comment body or reply body' },
      },
      required: ['op', 'workspace'],
      additionalProperties: false,
    },
  },
  {
    name: 'porcelain_profile',
    title: 'Manage the Repository Profile',
    description:
      'Get, replace, clear, or promote a project profile or worktree override. Profiles contain pins, hides, optional unhidden paths, and story layers. set replaces the selected level as a whole; get first. Promotion writes portable pins/hides to .porcelain/project.json and intentionally does not carry private story layers or worktree overrides.',
    inputSchema: {
      type: 'object',
      properties: {
        op: { enum: ['get', 'set', 'clear', 'promote'] },
        workspace: WORKSPACE,
        level: { enum: ['project', 'worktree'] },
        profile: PROFILE,
      },
      required: ['op', 'workspace', 'level'],
      additionalProperties: false,
    },
  },
  {
    name: 'porcelain_action',
    title: 'Manage Saved Actions',
    description:
      'List, read, create, update, or delete saved Actions. The agent authors Action definitions; the user starts them by clicking in Porcelain. This MCP surface has no execute, run, approve, or trust operation.',
    inputSchema: {
      type: 'object',
      properties: {
        op: { enum: ['list', 'get', 'create', 'update', 'delete'] },
        workspace: WORKSPACE,
        id: { type: 'string' },
        title: { type: 'string' },
        command: { type: 'string' },
        where: { enum: ['primary', 'local'] },
        kind: { enum: ['action', 'worktree-setup', 'worktree-dispose'] },
      },
      required: ['op', 'workspace'],
      additionalProperties: false,
    },
  },
])

export const MCP_TOOL_NAMES: readonly string[] = MCP_TOOLS.map((tool) => tool.name)
