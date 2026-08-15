import type { ReviewReading } from '@porcelain/contracts/review'

/** Intent is the case for the unit: thesis and authored documents, not the walkthrough. */
export function readingForIntent(reading: ReviewReading): ReviewReading {
  return { ...reading, sections: [], groups: [], evidence: null }
}

/** Process is the walkthrough: retain section prose/media while Execution owns every file. */
export function readingForProcess(reading: ReviewReading): ReviewReading {
  return {
    ...reading,
    thesis: undefined,
    sections: reading.sections.map((section) => ({ ...section, files: [] })),
    groups: [],
    evidence: null,
  }
}
