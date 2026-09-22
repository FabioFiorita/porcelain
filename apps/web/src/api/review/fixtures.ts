import type { Change, History } from '../../domain/review';

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
    oldOid: kind === 'added' ? null : 'b'.repeat(40),
    newOid: kind === 'deleted' ? null : 'c'.repeat(40),
    supported: true,
  });
  const comparisons: Change[] = [
    ordinary('src/components/review-panel.tsx', 'modified', 'staged'),
    ordinary('src/components/empty-state.tsx', 'added', 'staged'),
    ordinary('src/styles/theme.css', 'modified'),
    {
      ...ordinary('src/domain/review.ts', 'renamed'),
      oldPath: 'src/domain/context.ts',
    },
    ordinary('src/legacy-panel.tsx', 'deleted'),
    { scope: 'untracked', path: 'docs/review-notes.md' },
  ];
  const git = {
    environmentId,
    worktreeId,
    statusToken: 'a'.repeat(64),
    headOid: 'a'.repeat(40),
    branch: branch
      ? {
          name: branch,
          upstream: null as string | null,
          ahead: 0,
          behind: 0,
        }
      : null,
    comparisons,
  };
  const history: History = {
    snapshot: {
      tipOid: 'a'.repeat(40),
      head: branch ? { kind: 'attached', ref: branch } : { kind: 'detached' },
    },
    boundary: null,
    nextAfter: null,
    tip: 'a'.repeat(40),
    restarted: false,
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
      body: null,
      bodyTruncated: false,
      refs: [],
    })),
  };
  return { files, git, history };
}
