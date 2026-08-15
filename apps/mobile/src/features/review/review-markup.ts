import type { ReviewReading } from '@porcelain/contracts/review'
import { markdownToHtml } from '@/features/files'

/** Intent markup is the thesis only; authored Intent documents remain separate panes. */
export function intentMarkup(reading: ReviewReading): string | null {
  if (reading.thesis === undefined || reading.thesis.trim() === '') return null
  return markdownToHtml(reading.thesis)
}

/** Process markup is the walkthrough narrative, without the Execution file inventory. */
export function processMarkup(reading: ReviewReading): string | null {
  const parts: string[] = []
  for (const section of reading.sections) {
    if (section.title.trim() !== '') parts.push(markdownToHtml(`## ${section.title}`))
    if (section.prose.trim() !== '') parts.push(markdownToHtml(section.prose))
    if (section.diagram !== undefined) parts.push(section.diagram)
    if (section.html !== undefined) parts.push(section.html)
  }
  return parts.length === 0 ? null : parts.join('\n')
}
