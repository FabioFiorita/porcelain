import type { ReviewComment } from '@porcelain/contracts/review'
import {
  defaultCommentHandlers,
  renderComments,
} from '@renderer/features/review/comments/test-support'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { commentRowClass, LineDecorations } from './comment-marker'

function comment(
  partial: Partial<ReviewComment> & Pick<ReviewComment, 'id' | 'body'>,
): ReviewComment {
  return {
    path: 'src/a.ts',
    createdAt: 0,
    resolved: false,
    ...partial,
  }
}

describe('commentRowClass', () => {
  it('tints open comments with row bg-accent (under the text, never an overlay)', () => {
    expect(commentRowClass([comment({ id: '1', body: 'nits' })])).toBe('bg-accent')
  })

  it('prefers the pending composer tint over open comments', () => {
    expect(commentRowClass([comment({ id: '1', body: 'nits' })], true)).toBe('bg-primary/15')
    expect(commentRowClass(undefined, true)).toBe('bg-primary/15')
  })

  it('does not tint when every comment is resolved', () => {
    expect(commentRowClass([comment({ id: '1', body: 'done', resolved: true })])).toBeUndefined()
  })

  it('returns nothing with no comments and not pending', () => {
    expect(commentRowClass(undefined)).toBeUndefined()
    expect(commentRowClass([])).toBeUndefined()
  })
})

describe('LineDecorations', () => {
  it('renders only the gutter glyph — no absolute fill that would cover code', () => {
    const { container } = renderComments(
      <div className="relative flex">
        <LineDecorations comments={[comment({ id: '1', body: 'look here' })]} />
        <span>const x = 1</span>
      </div>,
      defaultCommentHandlers(),
    )
    expect(screen.getByText('const x = 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /1 comment/i })).toBeInTheDocument()
    // Regression: opaque absolute inset-0 bg-accent used to blank the line.
    expect(container.querySelector('.absolute.inset-0')).toBeNull()
    expect(container.querySelector('.bg-accent')).toBeNull()
  })

  it('renders nothing without comments', () => {
    const { container } = renderComments(
      <LineDecorations comments={undefined} />,
      defaultCommentHandlers(),
    )
    expect(container).toBeEmptyDOMElement()
  })
})
