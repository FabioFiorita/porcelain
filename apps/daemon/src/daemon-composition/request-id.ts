import { randomUUID } from 'node:crypto'

export function createRequestId(): string {
  return randomUUID()
}
