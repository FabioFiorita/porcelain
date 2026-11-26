import { describe, expect, it } from 'vite-plus/test';
import { reviewFormBinding } from '../commands/review-form.ts';
import {
  anchorLabel,
  commentFailureText,
  commentSpread,
  draftCountLabel,
  generalReviewNote,
  inlineReviewLocation,
  nodeCommentCounts,
  quotedAnswer,
  reviewForm,
  reviewRequest,
  type DraftComment,
} from './comments.ts';

const comment = (anchor: DraftComment['anchor']): DraftComment => ({
  id: JSON.stringify(anchor),
  anchor,
  text: 'Please rename this.',
  headOid: 'a'.repeat(40),
  createdAt: '2026-11-25T00:00:00.000Z',
  updatedAt: '2026-11-25T00:00:00.000Z',
  publication: { status: 'draft' },
  outdated: false,
});

describe('comment summary', () => {
  it('counts distinct files and the comments on the Walkthrough', () => {
    expect(
      commentSpread([
        comment({ kind: 'file', path: 'a.ts' }),
        comment({
          kind: 'lines',
          path: 'a.ts',
          side: 'additions',
          start: 1,
          end: 2,
          text: 'x',
        }),
        comment({ kind: 'file', path: 'b.ts' }),
        comment({ kind: 'step', title: 'Keep it' }),
      ]),
    ).toBe('on 2 files, 1 on the Walkthrough');
    expect(commentSpread([comment({ kind: 'file', path: 'a.ts' })])).toBe(
      'on 1 file',
    );
    expect(
      commentSpread([
        comment({ kind: 'node', title: 'Keep it', node: 'view' }),
      ]),
    ).toBe('1 on the Walkthrough');
  });

  it('counts draft comments in words', () => {
    expect(draftCountLabel(1)).toBe('1 draft comment');
    expect(draftCountLabel(3)).toBe('3 draft comments');
  });

  it('labels every anchor kind for the sheet title', () => {
    expect(
      anchorLabel({
        kind: 'lines',
        path: 'src/a.ts',
        side: 'deletions',
        start: 4,
        end: 6,
        text: 'x',
      }),
    ).toBe('src/a.ts · removed lines 4–6');
    expect(anchorLabel({ kind: 'file', path: 'src/a.ts' })).toBe('src/a.ts');
    expect(anchorLabel({ kind: 'step', title: 'Keep it' })).toBe(
      'Step · Keep it',
    );
    expect(anchorLabel({ kind: 'node', title: 'Keep it', node: 'view' })).toBe(
      'view · Keep it',
    );
  });
});

describe('review preview', () => {
  const preview = {
    kind: 'available' as const,
    pullRequest: {
      owner: 'acme',
      repo: 'notes',
      number: 4,
      url: 'https://example.com/4',
      title: 'Search',
    },
    headOid: 'a'.repeat(40),
    draftRevision: 'b'.repeat(64),
    inline: [
      {
        id: 'one',
        path: 'src/a.ts',
        side: 'LEFT' as const,
        startLine: 3,
        line: 5,
        body: 'First',
      },
      {
        id: 'two',
        path: 'src/b.ts',
        side: 'RIGHT' as const,
        line: 9,
        body: 'Second',
      },
    ],
    general: [
      {
        id: 'three',
        location: 'Step · Keep it',
        reason: 'step' as const,
        body: 'Third',
      },
    ],
  };

  it('places each inline comment on its file, range and side', () => {
    expect(preview.inline.map(inlineReviewLocation)).toEqual([
      'src/a.ts:3-5 (removed)',
      'src/b.ts:9',
    ]);
  });

  it('explains why a comment moved into the review body', () => {
    expect(generalReviewNote('not-in-pull-request')).toBe(
      'not in the pull request diff',
    );
    expect(generalReviewNote('file')).toBe('whole file');
    expect(generalReviewNote('step')).toBeUndefined();
  });

  it('starts from every previewed body and confirms the previewed destination, head and placement with trimmed bodies', () => {
    let form = reviewForm(preview);
    const update = (change: (current: typeof form) => typeof form) => {
      form = change(form);
    };
    reviewFormBinding([form, update], preview).edit('one')(' First! ');
    reviewFormBinding([form, update], preview).setSummary('Looks good');
    const bound = reviewFormBinding([form, update], preview);
    expect(bound.body('one')).toBe(' First! ');
    expect(bound.request).toEqual({
      pullRequest: { owner: 'acme', repo: 'notes', number: 4 },
      headOid: 'a'.repeat(40),
      draftRevision: 'b'.repeat(64),
      inlineIds: ['one', 'two'],
      summary: 'Looks good',
      bodies: { one: 'First!', two: 'Second', three: 'Third' },
    });
  });

  it('refuses to post while any previewed comment is emptied', () => {
    let form = reviewForm(preview);
    reviewFormBinding(
      [
        form,
        (change) => {
          form = change(form);
        },
      ],
      preview,
    ).edit('two')('  ');
    expect(reviewRequest(form, preview)).toBeUndefined();
  });
});

it('shows a short server message and falls back for anything else', () => {
  expect(commentFailureText(new Error('Too long.'), 'Not saved.')).toBe(
    'Too long.',
  );
  expect(commentFailureText({ message: '' }, 'Not saved.')).toBe('Not saved.');
  expect(commentFailureText('x'.repeat(400), 'Not saved.')).toBe('Not saved.');
});

it('quotes every line of the question above the agent’s answer', () => {
  expect(quotedAnswer('Why local?\nAnd later?', 'The owner decides.')).toBe(
    '> Why local?\n> And later?\n\nThe owner decides.',
  );
});

it('counts the open drafts on each node of one step’s diagrams', () => {
  const view = {
    branch: 'feature',
    headOid: 'a'.repeat(40),
    markdown: '',
    comments: [
      comment({ kind: 'node', title: 'Keep it', node: 'view' }),
      {
        ...comment({ kind: 'node', title: 'Keep it', node: 'view' }),
        id: 'second',
      },
      comment({ kind: 'node', title: 'Other step', node: 'view' }),
      {
        ...comment({ kind: 'node', title: 'Keep it', node: 'search' }),
        publication: {
          status: 'published' as const,
          url: 'https://example.com',
          publishedAt: '2026-11-25T00:00:00.000Z',
        },
      },
    ],
  };
  expect([...nodeCommentCounts(view, 'Keep it')]).toEqual([['view', 2]]);
});
