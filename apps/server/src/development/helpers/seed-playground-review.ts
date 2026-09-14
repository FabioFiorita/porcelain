import { randomUUID } from 'node:crypto';
import { commentThreadsSchema } from '@porcelain/contracts/comments';
import { reviewLayersResponseSchema } from '@porcelain/contracts/review-layers';

export async function seedPlaygroundReview(
  address: string,
  token: string,
  projectId: string,
  worktreeId: string,
  commitOid: string,
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
  const worktree = `/worktrees/${worktreeId}`;
  const project = `/projects/${projectId}`;
  // Explicitly associate the real review-guide commit, then replace the live order.
  const committedFile = { path: 'docs/review-guide.md', scope: 'staged' };
  const historical = reviewLayersResponseSchema.parse(
    await send('PUT', `${worktree}/review-layers`, {
      expectedRevision: 0,
      layers: [
        {
          id: randomUUID(),
          title: 'Explain the review workflow',
          summary:
            'The committed guide establishes the order for the release handoff.',
          files: [
            {
              ...committedFile,
              note: 'The guide is the committed review entry point.',
            },
          ],
        },
      ],
    }),
  );
  await send('PUT', `${project}/commits/${commitOid}/review-layers`, {
    sourceWorktreeId: worktreeId,
    sourceRevision: historical.revision,
    references: [committedFile],
  });
  await send('PUT', `${worktree}/review-layers`, {
    expectedRevision: historical.revision,
    layers: [
      {
        id: randomUUID(),
        title: 'Prepare release documentation',
        summary:
          'Release documents collect the reviewer-facing checklist and accessibility notes.',
        files: [
          {
            path: 'docs/release-checklist.md',
            scope: 'staged',
            note: 'The renamed checklist is the release entry point.',
          },
          {
            path: 'docs/accessibility.md',
            scope: 'staged',
            note: 'Captures the keyboard and narrow-screen checks.',
          },
          { path: 'README.md', scope: 'staged' },
        ],
      },
      {
        id: randomUUID(),
        title: 'Polish the board',
        summary:
          'Keep the board readable while the release changes are reviewed.',
        files: [
          {
            path: 'src/styles.css',
            scope: 'unstaged',
            note: 'Adds the review surface border treatment.',
          },
          { path: 'README.md', scope: 'unstaged' },
        ],
      },
    ],
  });
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
  await send('POST', `${worktree}/artifacts`, {
    name: 'handoff.html',
    content:
      '<!doctype html><html lang="en"><title>Launch review</title><h1>Fieldnotes launch review</h1><p>Three launch tasks; one completed.</p><ul><li>Verify narrow screen layout</li><li>Review staged release documents</li><li>Confirm empty-board task summaries</li></ul></html>',
  });
  await send('POST', `${worktree}/artifacts`, {
    name: 'handoff.md',
    content:
      'Prepared the release checklist and keyboard accessibility notes, then polished the board. Review the documents first, followed by the visual changes.\n\n### Verification\n\n- ✓ Task summaries have isolated domain tests.\n- ✓ Staged and unstaged changes remain visible together.\n- ✗ The image preview needs external inspection.\n',
  });
}
