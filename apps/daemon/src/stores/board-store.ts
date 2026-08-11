/**
 * Residual type-only surface for Web imports until BRD-004 moves Board types to
 * `@porcelain/contracts/board`. No runtime Board store remains here (BRD-002).
 */
export type CardStatus = 'todo' | 'doing' | 'done'

export type BoardCard = {
  id: string
  title: string
  body?: string
  status: CardStatus
  order: number
  createdAt: number
}
