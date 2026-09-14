import type {
  ArtifactContent,
  History,
  Layers,
  Status,
} from '../../domain/review';

/** Keep the mock's artifact bytes stable so content reads are reproducible. */
const LAUNCH_REVIEW_REPORT = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Launch review</title></head>
<body>
  <h1>Fieldnotes launch review</h1>
  <p>Three launch tasks; one completed.</p>
  <ul>
    <li>Verify narrow screen layout</li>
    <li>Review staged release documents</li>
    <li>Confirm empty-board task summaries</li>
  </ul>
</body>
</html>
`;

const ACCESSIBILITY_AUDIT = `# Keyboard accessibility audit

The review workspace keeps keyboard focus visible while moving between the
sidebar and document tabs.

## Verification

- ✓ Tab order follows the visible review structure.
- ✓ Narrow layouts keep the review navigator reachable.
`;

const DESIGN_STUDY = `Review workspace design study

The artifact reader keeps agent-authored notes outside the repository and
shows the original bytes without rewriting them.
`;

function artifactContent(
  id: string,
  worktreeId: string,
  name: string,
  content: string,
  sizeBytes: number,
  createdAt: string,
): ArtifactContent {
  return { id, worktreeId, name, content, sizeBytes, createdAt };
}

export function reviewFixture(
  worktreeId: string,
  environmentId: string,
  branch: string | null,
) {
  const files: Record<string, string> = {
    'README.md':
      '# Porcelain\n\nA quiet place to review agent-authored code.\n',
    'package.json': '{\n  "name": "porcelain",\n  "private": true\n}\n',
    'src/app.tsx':
      'export function App() {\n  return <Workspace title="Review workspace" />;\n}\n',
    'src/components/review-panel.tsx':
      'type ReviewPanelProps = { title: string };\n\nexport function ReviewPanel({ title }: ReviewPanelProps) {\n  return (\n    <section aria-label={title}>\n      <h1>{title}</h1>\n      <p>Choose a file to begin your review.</p>\n    </section>\n  );\n}\n',
    'src/components/empty-state.tsx':
      'export const emptyMessage = "You’re all caught up.";\n',
    'src/domain/review.ts':
      'export type ReviewScope = {\n  projectId: string;\n  worktreeId: string;\n};\n',
    'src/styles/theme.css': ':root {\n  --radius: 0.75rem;\n}\n',
    'docs/architecture/review-context-and-worktree-isolation.md':
      '# Review context\n\nEvery selection belongs to an environment, project and worktree.\n',
    'docs/review-notes.md':
      '# Review notes\n\nCheck keyboard focus and empty states.\n',
  };
  const ordinary = (
    path: string,
    kind: 'added' | 'modified' | 'deleted' | 'renamed',
    scope: 'staged' | 'unstaged' = 'unstaged',
  ) => ({
    scope,
    kind,
    oldPath: kind === 'added' ? null : path,
    newPath: kind === 'deleted' ? null : path,
    oldMode: '100644',
    newMode: '100644',
    supported: true,
  });
  const status: Status = {
    environmentId,
    worktreeId,
    statusToken: 'a'.repeat(64),
    consistency: 'best-effort',
    headOid: 'a'.repeat(40),
    changes: [
      ordinary('src/components/review-panel.tsx', 'modified', 'staged'),
      ordinary('src/components/empty-state.tsx', 'added', 'staged'),
      ordinary('src/styles/theme.css', 'modified'),
      {
        ...ordinary('src/domain/review.ts', 'renamed'),
        oldPath: 'src/domain/context.ts',
      },
      ordinary('src/legacy-panel.tsx', 'deleted'),
      { scope: 'untracked', path: 'docs/review-notes.md' },
    ],
  };
  const layers: Layers = {
    worktreeId,
    revision: 1,
    layers: [
      {
        id: 'bf4f1c6b-2b54-423b-a9b5-7c40112b3101',
        title: 'A clearer review experience',
        files: [
          { path: 'src/components/review-panel.tsx', scope: 'staged' },
          { path: 'src/components/empty-state.tsx', scope: 'staged' },
        ],
      },
      {
        id: 'bf4f1c6b-2b54-423b-a9b5-7c40112b3102',
        title: 'Refine the foundation',
        files: [
          { path: 'src/domain/review.ts', scope: 'unstaged' },
          { path: 'src/styles/theme.css', scope: 'unstaged' },
        ],
      },
    ],
  };
  const history: History = {
    snapshot: {
      tipOid: 'a'.repeat(40),
      head: branch ? { kind: 'attached', ref: branch } : { kind: 'detached' },
    },
    boundary: null,
    nextCursor: null,
    commits: [
      'Keep review context scoped to the worktree',
      'Add keyboard navigation to the workspace',
      'Introduce the review data contracts',
      'Set up the application foundation',
    ].map((subject, index) => ({
      oid: (index + 10).toString(16).repeat(40),
      parentOids: index === 3 ? [] : [(index + 11).toString(16).repeat(40)],
      author: {
        name: index % 2 ? 'Fabio Fiorita' : 'Alex Morgan',
        timestamp: `2026-09-0${9 - index}T14:30:00Z`,
      },
      subject,
      subjectTruncated: false,
    })),
  };
  const artifacts: ArtifactContent[] = [
    artifactContent(
      'afa08127-5c27-46bf-9d06-e8401f2aa101',
      worktreeId,
      'Launch review report',
      LAUNCH_REVIEW_REPORT,
      new TextEncoder().encode(LAUNCH_REVIEW_REPORT).byteLength,
      '2026-09-09T15:20:00Z',
    ),
    artifactContent(
      'afa08127-5c27-46bf-9d06-e8401f2aa102',
      worktreeId,
      'Keyboard accessibility audit',
      ACCESSIBILITY_AUDIT,
      new TextEncoder().encode(ACCESSIBILITY_AUDIT).byteLength,
      '2026-09-10T09:10:00Z',
    ),
    artifactContent(
      'afa08127-5c27-46bf-9d06-e8401f2aa103',
      worktreeId,
      'Review workspace · design study',
      DESIGN_STUDY,
      new TextEncoder().encode(DESIGN_STUDY).byteLength,
      '2026-09-11T11:45:00Z',
    ),
  ];
  return { files, status, layers, history, artifacts };
}
