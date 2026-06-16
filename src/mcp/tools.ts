import { describeComments, readComments, resolveComment } from './comment-file'
import {
  addReviewFiles,
  clearReview,
  describeReview,
  readReview,
  setReview,
  toReviewFiles,
} from './review-file'

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

export async function callTool(name: string, args: Record<string, unknown>): Promise<string> {
  const repoPath = asString(args.repoPath)
  if (!repoPath) throw new Error('repoPath is required')

  if (name === 'set_feature_review') {
    const reviewName = asString(args.name) ?? 'Feature view'
    const files = toReviewFiles(args.files)
    setReview(repoPath, reviewName, files)
    return `Set feature review "${reviewName}" (${files.length} files) for ${repoPath}`
  }
  if (name === 'add_review_files') {
    const files = toReviewFiles(args.files)
    const total = addReviewFiles(repoPath, files)
    return `Added ${files.length} file(s); the feature review now has ${total} for ${repoPath}`
  }
  if (name === 'clear_feature_review') {
    clearReview(repoPath)
    return `Cleared the feature review for ${repoPath}`
  }
  if (name === 'get_feature_review') {
    return describeReview(repoPath, readReview(repoPath))
  }
  if (name === 'get_review_comments') {
    return describeComments(repoPath, readComments(repoPath))
  }
  if (name === 'resolve_review_comment') {
    const id = asString(args.id)
    if (!id) throw new Error('id is required')
    return resolveComment(repoPath, id)
      ? `Resolved comment ${id} for ${repoPath}`
      : `No open comment ${id} for ${repoPath}`
  }
  throw new Error(`unknown tool: ${name}`)
}
