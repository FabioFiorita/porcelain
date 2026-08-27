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

const CANVAS_FILE = {
  type: 'object',
  properties: {
    path: { type: 'string', description: 'Bundle-relative path' },
    content: { type: 'string' },
  },
  required: ['path', 'content'],
  additionalProperties: false,
} as const

const STRUCTURED_BLOCK = {
  oneOf: [
    {
      type: 'object',
      properties: { type: { const: 'markdown' }, content: { type: 'string' } },
      required: ['type', 'content'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        type: { const: 'html' },
        content: { type: 'string' },
        height: { type: 'integer', minimum: 160, maximum: 1200 },
      },
      required: ['type', 'content'],
      additionalProperties: false,
    },
  ],
} as const

const STRUCTURED_ASSET = {
  oneOf: [
    {
      type: 'object',
      properties: {
        type: { const: 'image' },
        path: { type: 'string' },
        alt: { type: 'string' },
        caption: { type: 'string' },
      },
      required: ['type', 'path', 'alt'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        type: { const: 'video' },
        path: { type: 'string' },
        label: { type: 'string' },
        caption: { type: 'string' },
        captionsPath: { type: 'string' },
      },
      required: ['type', 'path', 'label'],
      additionalProperties: false,
    },
  ],
} as const

const STRUCTURED_TAB = {
  type: 'object',
  properties: {
    id: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]*$' },
    label: { type: 'string', minLength: 1, maxLength: 24 },
    blocks: { type: 'array', minItems: 1, maxItems: 16, items: STRUCTURED_BLOCK },
  },
  required: ['id', 'label', 'blocks'],
  additionalProperties: false,
} as const

const STRUCTURED_CANVAS = {
  type: 'object',
  properties: {
    version: { const: 1 },
    title: { type: 'string', minLength: 1, maxLength: 120 },
    tabs: {
      type: 'array',
      minItems: 1,
      maxItems: 4,
      items: STRUCTURED_TAB,
    },
    assets: { type: 'array', maxItems: 64, items: STRUCTURED_ASSET },
  },
  required: ['version', 'title', 'tabs'],
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

const REVIEW_TEMPLATE = {
  type: 'object',
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 120 },
    why: { type: 'array', minItems: 1, maxItems: 16, items: STRUCTURED_BLOCK },
    how: { type: 'array', minItems: 1, maxItems: 16, items: STRUCTURED_BLOCK },
    layers: { type: 'array', items: PROFILE_LAYER },
    files: { type: 'array', items: REVIEW_FILE },
    assets: { type: 'array', maxItems: 64, items: STRUCTURED_ASSET },
  },
  required: ['title', 'why', 'how'],
  additionalProperties: false,
} as const

const PLAN_TEMPLATE = {
  type: 'object',
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 120 },
    tabs: { type: 'array', minItems: 1, maxItems: 4, items: STRUCTURED_TAB },
    assets: { type: 'array', maxItems: 64, items: STRUCTURED_ASSET },
  },
  required: ['title', 'tabs'],
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
      'List, read, create, update, delete, or promote an agent-authored Canvas. Prefer document for a custom validated structured Canvas; sourceDir may provide bundle assets. Built-in review and plan templates compile into that same renderer. Review fixes Why/How and owns its file layers; Plan chooses bounded tabs. Each Review create is scoped to the addressed Worktree, and update requires its id. Promotion writes files but never stages or commits.',
    inputSchema: {
      type: 'object',
      properties: {
        op: { enum: ['list', 'get', 'create', 'update', 'delete', 'promote'] },
        workspace: WORKSPACE,
        id: { type: 'string', description: 'Canvas id for get/update/delete/promote' },
        title: { type: 'string' },
        kind: { enum: ['html', 'markdown'] },
        sourceDir: {
          type: 'string',
          description: 'Absolute bundle directory, or assets directory when document is provided',
        },
        entry: { type: 'string', description: 'Bundle-relative entry file' },
        files: { type: 'array', items: CANVAS_FILE },
        document: STRUCTURED_CANVAS,
        tracked: {
          type: 'boolean',
          description: 'Create or update directly in the tracked checkout overlay',
        },
        template: { enum: ['review', 'plan'] },
        templateData: { oneOf: [REVIEW_TEMPLATE, PLAN_TEMPLATE] },
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
      'Read the manual project navigation profile or promote its portable pins/hides to .porcelain/project.json. Review layers belong to each Review Canvas, never to a persistent profile.',
    inputSchema: {
      type: 'object',
      properties: {
        op: { enum: ['get', 'promote'] },
        workspace: WORKSPACE,
        level: { const: 'project' },
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
