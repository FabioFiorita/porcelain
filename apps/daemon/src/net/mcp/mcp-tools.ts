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

const CANVAS_FILE = {
  type: 'object',
  properties: {
    path: { type: 'string', description: 'Bundle-relative path' },
    content: { type: 'string' },
  },
  required: ['path', 'content'],
  additionalProperties: false,
} as const

const PROFILE_LAYER = {
  type: 'object',
  properties: { label: { type: 'string' }, pattern: { type: 'string' } },
  required: ['label', 'pattern'],
  additionalProperties: false,
} as const

const FILE_REFERENCE = {
  type: 'object',
  properties: {
    path: { type: 'string', description: 'Repository-relative file path' },
    line: { type: 'integer', minimum: 1 },
    label: { type: 'string' },
  },
  required: ['path'],
  additionalProperties: false,
} as const

const DECISION_OPTION = {
  type: 'object',
  properties: {
    id: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]*$' },
    name: { type: 'string' },
    summary: { type: 'string' },
    pros: { type: 'array', items: { type: 'string' } },
    cons: { type: 'array', items: { type: 'string' } },
    risks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          severity: { enum: ['low', 'medium', 'high'] },
          mitigation: { type: 'string' },
        },
        required: ['summary'],
        additionalProperties: false,
      },
    },
    effort: { type: 'string' },
    references: { type: 'array', items: FILE_REFERENCE },
  },
  required: ['id', 'name', 'summary'],
  additionalProperties: false,
} as const

const DECISION_FIELDS = {
  title: { type: 'string', minLength: 1, maxLength: 120 },
  summary: { type: 'string' },
  context: { type: 'string' },
  references: { type: 'array', items: FILE_REFERENCE },
  options: { type: 'array', minItems: 2, maxItems: 6, items: DECISION_OPTION },
  criteria: {
    type: 'array',
    minItems: 1,
    maxItems: 12,
    items: {
      type: 'object',
      properties: {
        id: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]*$' },
        label: { type: 'string' },
        description: { type: 'string' },
      },
      required: ['id', 'label'],
      additionalProperties: false,
    },
  },
  assessments: {
    type: 'array',
    maxItems: 72,
    items: {
      type: 'object',
      properties: {
        optionId: { type: 'string' },
        criterionId: { type: 'string' },
        rating: { enum: ['poor', 'fair', 'good', 'strong'] },
        note: { type: 'string' },
      },
      required: ['optionId', 'criterionId', 'rating', 'note'],
      additionalProperties: false,
    },
  },
  recommendation: {
    type: 'object',
    properties: {
      optionId: { type: 'string' },
      summary: { type: 'string' },
      rationale: { type: 'array', minItems: 1, items: { type: 'string' } },
      confidence: { enum: ['low', 'medium', 'high'] },
      assumptions: { type: 'array', items: { type: 'string' } },
      changeConditions: { type: 'array', items: { type: 'string' } },
      references: { type: 'array', items: FILE_REFERENCE },
    },
    required: ['summary', 'rationale', 'confidence'],
    additionalProperties: false,
  },
  decision: {
    type: 'object',
    properties: {
      optionId: { type: 'string' },
      summary: { type: 'string' },
      rationale: { type: 'array', items: { type: 'string' } },
      references: { type: 'array', items: FILE_REFERENCE },
    },
    required: ['summary'],
    additionalProperties: false,
  },
} as const

const DECISION_TEMPLATE = {
  type: 'object',
  properties: DECISION_FIELDS,
  required: ['title', 'summary', 'options', 'criteria', 'assessments', 'recommendation'],
  additionalProperties: false,
} as const

const DECISION_DOCUMENT = {
  ...DECISION_TEMPLATE,
  properties: {
    version: { const: 2 },
    template: { const: 'decision' },
    ...DECISION_FIELDS,
  },
  required: [
    'version',
    'template',
    'title',
    'summary',
    'options',
    'criteria',
    'assessments',
    'recommendation',
  ],
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

const REVIEW_REFERENCE = {
  type: 'object',
  properties: {
    path: { type: 'string', minLength: 1, maxLength: 512 },
    startLine: { type: 'integer', minimum: 1 },
    endLine: { type: 'integer', minimum: 1 },
    label: { type: 'string', minLength: 1, maxLength: 120 },
  },
  required: ['path'],
  additionalProperties: false,
} as const

const REVIEW_SECTION = {
  type: 'object',
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 200 },
    prose: { type: 'string', maxLength: 32_768 },
    svg: { type: 'string', minLength: 1, maxLength: 262_144 },
    html: { type: 'string', minLength: 1, maxLength: 524_288 },
    htmlHeight: { type: 'integer', minimum: 160, maximum: 1600 },
    references: { type: 'array', maxItems: 40, items: REVIEW_REFERENCE },
  },
  required: ['title', 'prose'],
  additionalProperties: false,
} as const

const REVIEW_EVIDENCE = {
  type: 'object',
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 200 },
    checks: {
      type: 'array',
      maxItems: 32,
      items: {
        type: 'object',
        properties: {
          label: { type: 'string', minLength: 1, maxLength: 120 },
          status: { enum: ['pass', 'fail', 'skip'] },
          detail: { type: 'string', maxLength: 400 },
        },
        required: ['label', 'status'],
        additionalProperties: false,
      },
    },
    assets: {
      type: 'array',
      maxItems: 60,
      items: {
        oneOf: [
          {
            type: 'object',
            properties: {
              kind: { enum: ['image', 'video', 'document'] },
              path: { type: 'string', minLength: 1, maxLength: 512 },
              label: { type: 'string', minLength: 1, maxLength: 120 },
              mime: { type: 'string', minLength: 1, maxLength: 120 },
            },
            required: ['kind', 'path', 'label'],
            additionalProperties: false,
          },
          {
            type: 'object',
            properties: {
              kind: { const: 'link' },
              href: { type: 'string', format: 'uri' },
              label: { type: 'string', minLength: 1, maxLength: 120 },
            },
            required: ['kind', 'href', 'label'],
            additionalProperties: false,
          },
        ],
      },
    },
  },
  additionalProperties: false,
} as const

const REVIEW_CONTENT_FIELDS = {
  title: { type: 'string', minLength: 1, maxLength: 120 },
  summary: { type: 'string', minLength: 1, maxLength: 4096 },
  sections: { type: 'array', minItems: 1, maxItems: 30, items: REVIEW_SECTION },
  evidence: REVIEW_EVIDENCE,
} as const

const REVIEW_TEMPLATE = {
  type: 'object',
  properties: {
    ...REVIEW_CONTENT_FIELDS,
    why: { type: 'string', minLength: 1 },
    how: { type: 'string', minLength: 1 },
    layers: { type: 'array', items: PROFILE_LAYER },
    files: { type: 'array', items: REVIEW_FILE },
  },
  required: ['title'],
  anyOf: [
    { required: ['sections'] },
    {
      required: ['why', 'how'],
    },
  ],
  additionalProperties: false,
} as const

const REVIEW_DOCUMENT = {
  type: 'object',
  properties: {
    version: { const: 2 },
    template: { const: 'review' },
    ...REVIEW_CONTENT_FIELDS,
  },
  required: ['version', 'template', 'title', 'sections'],
  additionalProperties: false,
} as const

const STRUCTURED_CANVAS = { oneOf: [DECISION_DOCUMENT, REVIEW_DOCUMENT] } as const

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
      'List, read, create, update, delete, or promote an agent-authored Canvas. Decision captures an unresolved choice. Review supports ordered prose, sandboxed SVG/HTML, code references, evidence checks and assets, plus attention-ordered layers/files; clean Review writes bind History. File references never own diffs or reviewed state. Promotion writes files but never stages or commits.',
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
        template: { enum: ['decision', 'review'] },
        templateData: { oneOf: [DECISION_TEMPLATE, REVIEW_TEMPLATE] },
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
    name: 'porcelain_review',
    title: 'Manage Reviewed State',
    description:
      'Read the paths whose current diffs are marked reviewed, or mark/unmark explicit repository-relative paths. Marks are content-bound and become stale when a diff changes. This does not stage or commit files.',
    inputSchema: {
      type: 'object',
      properties: {
        op: { enum: ['get-reviewed', 'mark', 'unmark'] },
        workspace: WORKSPACE,
        paths: {
          type: 'array',
          minItems: 1,
          items: { type: 'string', description: 'Repository-relative changed-file path' },
        },
      },
      required: ['op', 'workspace'],
      additionalProperties: false,
    },
  },
  {
    name: 'porcelain_profile',
    title: 'Manage the Repository Profile',
    description:
      'Read the manual project navigation profile, explicitly pin/unpin or hide/unhide one repository-relative path, or promote its portable pins/hides to .porcelain/project.json. Pins and hides are human navigation choices: change them only when the human asks.',
    inputSchema: {
      type: 'object',
      properties: {
        op: { enum: ['get', 'pin', 'unpin', 'hide', 'unhide', 'promote'] },
        workspace: WORKSPACE,
        level: { const: 'project' },
        path: { type: 'string', description: 'Repository-relative path for a pin/hide operation' },
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
