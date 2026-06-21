import {
  createAction,
  deleteAction,
  describeActions,
  readActions,
  updateAction,
} from './action-file'
import {
  createCard,
  deleteCard,
  describeBoard,
  moveCard,
  normalizeStatus,
  readCards,
  updateCard,
} from './board-file'
import { describeComments, readComments, resolveComment } from './comment-file'
import { clearLayers, describeLayers, readLayers, setLayers, toLayers } from './layers-file'
import { describeNotes, readNotes } from './notes-file'
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
  if (name === 'list_cards') {
    return describeBoard(repoPath, readCards(repoPath))
  }
  if (name === 'create_card') {
    const title = asString(args.title)
    if (!title) throw new Error('title is required')
    const status = normalizeStatus(args.status) ?? 'todo'
    const card = createCard(repoPath, title, asString(args.body), status)
    return `Created card ${card.id} "${title}" in ${status} for ${repoPath}`
  }
  if (name === 'update_card') {
    const id = asString(args.id)
    if (!id) throw new Error('id is required')
    const found = updateCard(repoPath, id, {
      title: asString(args.title),
      body: asString(args.body),
    })
    return found ? `Updated card ${id} for ${repoPath}` : `No card ${id} for ${repoPath}`
  }
  if (name === 'move_card') {
    const id = asString(args.id)
    if (!id) throw new Error('id is required')
    const status = normalizeStatus(args.status)
    if (!status) throw new Error('status must be one of todo|doing|done')
    return moveCard(repoPath, id, status)
      ? `Moved card ${id} to ${status} for ${repoPath}`
      : `No card ${id} for ${repoPath}`
  }
  if (name === 'delete_card') {
    const id = asString(args.id)
    if (!id) throw new Error('id is required')
    return deleteCard(repoPath, id)
      ? `Deleted card ${id} for ${repoPath}`
      : `No card ${id} for ${repoPath}`
  }
  if (name === 'list_actions') {
    return describeActions(repoPath, readActions(repoPath))
  }
  if (name === 'create_action') {
    const title = asString(args.title)
    const command = asString(args.command)
    if (!title) throw new Error('title is required')
    if (!command) throw new Error('command is required')
    const action = createAction(repoPath, title, command, asString(args.cwd))
    return `Created action ${action.id} "${title}" for ${repoPath}`
  }
  if (name === 'update_action') {
    const id = asString(args.id)
    if (!id) throw new Error('id is required')
    const found = updateAction(repoPath, id, {
      title: asString(args.title),
      command: asString(args.command),
      cwd: asString(args.cwd),
    })
    return found ? `Updated action ${id} for ${repoPath}` : `No action ${id} for ${repoPath}`
  }
  if (name === 'delete_action') {
    const id = asString(args.id)
    if (!id) throw new Error('id is required')
    return deleteAction(repoPath, id)
      ? `Deleted action ${id} for ${repoPath}`
      : `No action ${id} for ${repoPath}`
  }
  if (name === 'get_repo_notes') {
    return describeNotes(repoPath, readNotes(repoPath))
  }
  if (name === 'get_flow_layers') {
    return describeLayers(repoPath, readLayers(repoPath))
  }
  if (name === 'set_flow_layers') {
    const layers = toLayers(args.layers)
    setLayers(repoPath, layers)
    return `Set ${layers.length} flow layer(s) for ${repoPath}: ${layers.map((l) => l.label).join(' → ')}`
  }
  if (name === 'reset_flow_layers') {
    clearLayers(repoPath)
    return `Reset flow layers to the built-in defaults for ${repoPath}`
  }
  throw new Error(`unknown tool: ${name}`)
}
