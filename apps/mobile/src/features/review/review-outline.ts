import type { FeatureReading, ReadingFile } from '@/lib/daemon/procedures/review'

export type ReviewChapter = {
  index: number
  title: string
  prose: string
  diagram?: string
  html?: string
  htmlHeight?: number
  files: ReadingFile[]
  moreFiles: boolean
}

export type ReviewExecutionGroup = {
  layer: string
  files: ReadingFile[]
}

/** Unique files in the same document order as the agent's sections and More files group. */
export function outlineFiles(reading: FeatureReading): ReadingFile[] {
  const seen = new Set<string>()
  const files: ReadingFile[] = []
  for (const file of [
    ...reading.sections.flatMap((section) => section.files),
    ...reading.groups.flatMap((group) => group.files),
  ]) {
    if (seen.has(file.path)) continue
    seen.add(file.path)
    files.push(file)
  }
  return files
}

export function reviewedFraction(
  reading: FeatureReading,
  reviewedPaths: readonly string[],
): number {
  const files = outlineFiles(reading)
  if (files.length === 0) return 0
  const reviewed = new Set(reviewedPaths)
  return files.filter((file) => reviewed.has(file.path)).length / files.length
}

/** Intent chapters plus the synthetic More files stop used by the desktop outline. */
export function reviewChapters(reading: FeatureReading): ReviewChapter[] {
  const chapters = reading.sections.map(
    (section, index): ReviewChapter => ({
      diagram: section.diagram,
      files: section.files,
      html: section.html,
      htmlHeight: section.htmlHeight,
      index,
      moreFiles: false,
      prose: section.prose,
      title: section.title,
    }),
  )
  if (reading.groups.length === 0) return chapters
  return [
    ...chapters,
    {
      files: reading.groups.flatMap((group) => group.files),
      index: chapters.length,
      moreFiles: true,
      prose: '',
      title: 'More files',
    },
  ]
}

/** Keep anchored files visible in Execution; the daemon removes them from More files groups. */
export function executionGroups(reading: FeatureReading): ReviewExecutionGroup[] {
  const seen = new Set<string>()
  const groups: ReviewExecutionGroup[] = []
  const append = (layer: string, files: readonly ReadingFile[]): void => {
    const unique = files.filter((file) => {
      if (seen.has(file.path)) return false
      seen.add(file.path)
      return true
    })
    if (unique.length > 0) groups.push({ files: unique, layer })
  }

  for (const section of reading.sections) append(section.title, section.files)
  for (const group of reading.groups) append(group.layer, group.files)
  return groups
}
