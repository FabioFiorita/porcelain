import { commentThreadsSchema } from '@porcelain/contracts/comments';
import { reviewReadResponseSchema } from '@porcelain/contracts/review';

export async function seedPlaygroundReview(
  address: string,
  token: string,
  projectId: string,
  worktreeId: string,
  signal: AbortSignal,
) {
  const send = async (method: string, path: string, body: unknown) => {
    const response = await fetch(`${address}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    });
    if (!response.ok)
      throw new Error(
        `Could not seed playground review: ${method} ${path} (${response.status})`,
      );
    return response.json();
  };
  const worktree = `/api/worktrees/${worktreeId}`;
  const project = `/api/projects/${projectId}`;
  reviewReadResponseSchema.parse(
    await send('PUT', `${worktree}/review`, {
      expectedRevision: 0,
      summaryHtml:
        '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Launch review</title><style>body{font:16px system-ui;background:var(--porcelain-background);color:var(--porcelain-foreground);max-width:760px;margin:4rem auto;padding:0 2rem}a{color:inherit}</style></head><body><h1>Fieldnotes launch review</h1><p>Release documentation and the board polish are ready to review.</p><ol><li><a href="#layer-1">Prepare release documentation</a></li><li><a href="#layer-2">Polish the board</a></li></ol><h2>Verification</h2><p>Task summaries passed their isolated domain tests.</p></body></html>',
      diagram: {
        before: {
          lanes: ['Review'],
          boxes: [
            {
              id: '30000000-0000-4000-8000-000000000001',
              lane: 0,
              label: 'Launch notes',
              kind: 'component',
              problem: 'Release checks and visual polish were mixed together.',
            },
          ],
          arrows: [],
        },
        after: {
          lanes: ['Documentation', 'Web'],
          boxes: [
            {
              id: '30000000-0000-4000-8000-000000000002',
              lane: 0,
              label: 'Release checklist',
              detail: 'Reviewer-facing readiness and accessibility checks',
              kind: 'component',
              change: 'new',
              layerId: '10000000-0000-4000-8000-000000000001',
            },
            {
              id: '30000000-0000-4000-8000-000000000003',
              lane: 1,
              label: 'Task board',
              detail: 'Clear card boundaries for review',
              kind: 'component',
              change: 'changed',
              layerId: '10000000-0000-4000-8000-000000000002',
            },
          ],
          arrows: [
            {
              from: '30000000-0000-4000-8000-000000000002',
              to: '30000000-0000-4000-8000-000000000003',
              label: 'review then inspect',
            },
          ],
        },
      },
      layers: [
        {
          id: '10000000-0000-4000-8000-000000000001',
          title: 'Prepare release documentation',
          summary:
            'Release documents collect the reviewer-facing checklist and accessibility notes.',
          lanes: ['Documentation'],
          steps: [
            {
              id: '20000000-0000-4000-8000-000000000001',
              lane: 0,
              title: 'Release checklist',
              text: 'The renamed checklist is the release entry point.',
              kind: 'changed',
              pointer: {
                path: 'docs/release-checklist.md',
                startLine: 1,
                endLine: 4,
              },
            },
            {
              id: '20000000-0000-4000-8000-000000000002',
              lane: 0,
              title: 'Accessibility checks',
              text: 'Captures the keyboard and status-announcement checks.',
              kind: 'changed',
              pointer: {
                path: 'docs/accessibility.md',
                startLine: 1,
                endLine: 4,
              },
            },
          ],
        },
        {
          id: '10000000-0000-4000-8000-000000000002',
          title: 'Polish the board',
          summary:
            'Keep the board readable while the release changes are reviewed.',
          lanes: ['Web'],
          steps: [
            {
              id: '20000000-0000-4000-8000-000000000003',
              lane: 0,
              title: 'Task card boundary',
              text: 'Adds the review surface border treatment.',
              kind: 'changed',
              pointer: { path: 'src/styles.css', startLine: 31, endLine: 31 },
            },
          ],
        },
      ],
    }),
  );
  const [thread] = commentThreadsSchema.parse(
    await send('POST', `${worktree}/comments`, {
      anchor: {
        kind: 'codeRange',
        filePath: 'src/task-store.mjs',
        startLine: 1,
        endLine: 6,
      },
      body: 'Can we confirm that an empty board reports zero completed tasks?',
    }),
  );
  if (!thread) throw new Error('Playground comment was not created');
  await send('POST', `${worktree}/comments/${thread.id}/replies`, {
    body: 'Covered by the empty-board domain test. Run node --test tests/task-store.spec.mjs.',
  });
  await send('PUT', `${project}/file-preferences`, {
    path: 'src',
    flag: 'pinned',
    value: true,
  });
  await send('PUT', `${project}/file-preferences`, {
    path: '.cache',
    flag: 'hidden',
    value: true,
  });
}
