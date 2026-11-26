import { describe, expect, it } from 'vite-plus/test';
import type { DraftCommentView } from '../models/draft-comment.ts';
import {
  reviewPayload,
  draftCommentsMarkdown,
  draftOutdated,
  patchLines,
  planPullRequestReview,
} from './draft-comments.ts';

const PATCH = [
  '@@ -1,4 +1,5 @@',
  ' export function find(notes, query) {',
  '-  return notes;',
  '+  const needle = query.toLowerCase();',
  '+  return notes.filter((note) => note.includes(needle));',
  ' }',
  ' ',
  '@@ -20,2 +21,3 @@ export function label() {',
  ' const a = 1;',
  '+const b = 2;',
  ' const c = 3;',
].join('\n');

function draft(
  id: string,
  anchor: DraftCommentView['anchor'],
  extra: Partial<DraftCommentView> = {},
): DraftCommentView {
  return {
    id,
    anchor,
    text: `comment ${id}`,
    headOid: 'a'.repeat(40),
    createdAt: '2026-11-25T10:00:00.000Z',
    updatedAt: '2026-11-25T10:00:00.000Z',
    publication: { status: 'draft' },
    outdated: false,
    ...extra,
  };
}

const lines = (
  start: number,
  end: number,
  text: string,
  side: 'additions' | 'deletions' = 'additions',
) => ({
  kind: 'lines' as const,
  path: 'src/search.ts',
  side,
  start,
  end,
  text,
});

describe('patchLines', () => {
  it('numbers both sides of each hunk, sharing context lines', () => {
    const parsed = patchLines(PATCH);
    expect(parsed.additions.get(2)).toBe(
      '  const needle = query.toLowerCase();',
    );
    expect(parsed.deletions.get(2)).toBe('  return notes;');
    expect(parsed.additions.get(4)).toBe('}');
    expect(parsed.deletions.get(3)).toBe('}');
    expect(parsed.additions.get(22)).toBe('const b = 2;');
    expect(parsed.additions.has(10)).toBe(false);
  });
});

describe('draftOutdated', () => {
  const file = 'one\ntwo\nthree\n';
  it('keeps a comment current while its lines read the same', () => {
    expect(draftOutdated(lines(2, 3, 'two\nthree'), file)).toBe(false);
  });
  it('marks a comment outdated when its lines changed or the file is gone', () => {
    expect(draftOutdated(lines(2, 3, 'two\nTHREE'), file)).toBe(true);
    expect(draftOutdated(lines(9, 9, 'nine'), file)).toBe(true);
    expect(draftOutdated(lines(1, 1, 'one'), undefined)).toBe(true);
  });
  it('never marks removed lines or step comments outdated', () => {
    expect(draftOutdated(lines(1, 1, 'gone', 'deletions'), undefined)).toBe(
      false,
    );
    expect(draftOutdated({ kind: 'step', title: 'Search' }, undefined)).toBe(
      false,
    );
  });
});

describe('planPullRequestReview', () => {
  const diff = {
    headOid: 'b'.repeat(40),
    files: [
      { path: 'src/search.ts', patch: PATCH },
      { path: 'assets/logo.png', patch: undefined },
    ],
  };

  it('attaches comments on diff lines to their file and line', () => {
    const plan = planPullRequestReview(
      [
        draft(
          'range',
          lines(
            2,
            3,
            '  const needle = query.toLowerCase();\n  return notes.filter((note) => note.includes(needle));',
          ),
        ),
        draft('removed', lines(2, 2, '  return notes;', 'deletions')),
      ],
      diff,
    );
    expect(plan).toEqual({
      inline: [
        {
          id: 'range',
          path: 'src/search.ts',
          side: 'RIGHT',
          startLine: 2,
          line: 3,
          body: 'comment range',
        },
        {
          id: 'removed',
          path: 'src/search.ts',
          side: 'LEFT',
          line: 2,
          body: 'comment removed',
        },
      ],
      general: [],
    });
  });

  it('moves every comment GitHub cannot place into the body with its location', () => {
    const plan = planPullRequestReview(
      [
        draft('two-hunks', lines(4, 21, 'x')),
        draft('unchanged', lines(10, 10, 'const z = 0;')),
        draft('moved', lines(2, 2, 'not this text')),
        draft('binary', {
          kind: 'lines',
          path: 'assets/logo.png',
          side: 'additions',
          start: 1,
          end: 1,
          text: '',
        }),
        draft('stale', lines(22, 22, 'const b = 2;'), { outdated: true }),
        draft('file', { kind: 'file', path: 'src/search.ts' }),
        draft('step', { kind: 'step', title: 'Choose the empty search' }),
        draft('node', {
          kind: 'node',
          title: 'Choose the empty search',
          node: 'findNotes',
        }),
        draft('posted', lines(22, 22, 'const b = 2;'), {
          publication: {
            status: 'published',
            url: 'https://github.com/o/r/pull/1#pullrequestreview-1',
            publishedAt: '2026-11-25T11:00:00.000Z',
          },
        }),
      ],
      diff,
    );
    expect(plan.inline).toEqual([]);
    expect(
      plan.general.map(({ id, location, reason }) => [id, location, reason]),
    ).toEqual([
      ['two-hunks', 'src/search.ts:4-21', 'not-in-pull-request'],
      ['unchanged', 'src/search.ts:10', 'not-in-pull-request'],
      ['moved', 'src/search.ts:2', 'not-in-pull-request'],
      ['binary', 'assets/logo.png:1', 'not-in-pull-request'],
      ['stale', 'src/search.ts:22', 'outdated'],
      ['file', 'src/search.ts', 'file'],
      ['step', 'Walkthrough step “Choose the empty search”', 'step'],
      [
        'node',
        'Walkthrough step “Choose the empty search”, diagram node “findNotes”',
        'node',
      ],
    ]);
  });
});

describe('reviewPayload', () => {
  const plan = {
    inline: [
      {
        id: 'a',
        path: 'src/search.ts',
        side: 'RIGHT' as const,
        line: 3,
        body: 'Edited a',
      },
    ],
    general: [
      {
        id: 'b',
        location: 'Walkthrough step “Search”',
        reason: 'step' as const,
        body: 'Edited b\n',
      },
    ],
  };

  it('puts general comments after the summary', () => {
    expect(reviewPayload(plan, '  Looks close.  ')).toEqual({
      ids: ['a', 'b'],
      body: 'Looks close.\n\n**Walkthrough step “Search”**\n\nEdited b',
      comments: [
        { path: 'src/search.ts', side: 'RIGHT', line: 3, body: 'Edited a' },
      ],
    });
  });

  it('gives GitHub a body when only inline comments are confirmed', () => {
    expect(reviewPayload({ inline: plan.inline, general: [] }, '').body).toBe(
      '1 inline comment.',
    );
  });
});

describe('draftCommentsMarkdown', () => {
  it('groups open comments by file or step for an agent to act on', () => {
    const markdown = draftCommentsMarkdown({
      branch: 'feature/note-search',
      headOid: '79dba35aa',
      command: 'porcelain comments',
      comments: [
        draft('1', lines(2, 2, '  return notes;'), {
          text: 'Lower-case the query once.',
        }),
        draft(
          '2',
          { kind: 'step', title: 'Choose the empty search' },
          {
            text: 'Show no notes.',
          },
        ),
        draft('3', lines(4, 4, '}'), {
          text: 'Close this earlier.',
          outdated: true,
        }),
        draft(
          '4',
          { kind: 'file', path: 'src/old.ts' },
          {
            publication: {
              status: 'published',
              url: 'u',
              publishedAt: 'p',
            },
          },
        ),
      ],
    });
    expect(markdown).toBe(
      [
        '# Review comments on `feature/note-search`',
        '',
        'Head commit `79dba35aa`. 3 comments to address. Line numbers refer to the file at that commit; removed lines refer to the base.',
        '',
        '## `src/search.ts`',
        '',
        '### Line 2',
        '',
        '```',
        '  return notes;',
        '```',
        '',
        'Lower-case the query once.',
        '',
        '### Line 4 (outdated: these lines changed after the comment was written)',
        '',
        '```',
        '}',
        '```',
        '',
        'Close this earlier.',
        '',
        '## Walkthrough step “Choose the empty search”',
        '',
        '### The step',
        '',
        'Show no notes.',
        '',
        '---',
        '',
        'Print these comments again from this worktree with `porcelain comments`.',
        '',
      ].join('\n'),
    );
  });

  it('fences code that itself contains backticks', () => {
    const markdown = draftCommentsMarkdown({
      branch: 'b',
      headOid: 'h',
      command: 'porcelain comments',
      comments: [draft('1', lines(1, 1, 'const s = ```x```;'))],
    });
    expect(markdown).toContain('````\nconst s = ```x```;\n````');
  });
});
