const probeVariants = ['normal 400', 'normal 700', 'italic 400', 'italic 700'] as const
const probeGlyphs = ['i', 'M', 'W', '0', '@', '#', '.', ' '] as const
const advanceTolerance = 0.01

function normalizedFamilies(family: string): string | null {
  const families = family
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
  return families.length > 0 ? families.join(', ') : null
}

/**
 * Canvas cells and selections occupy a monospace grid. Ignore unavailable
 * measurement APIs so a constrained browser can still use its normal fallback.
 */
export function isMonospaceFamily(family: string): boolean {
  const families = normalizedFamilies(family)
  if (families === null || typeof document === 'undefined') return true
  try {
    const context = document.createElement('canvas').getContext('2d')
    if (context === null) return true
    return probeVariants.every((variant) => {
      context.font = `${variant} 32px ${families}, monospace`
      const advances = probeGlyphs.map((glyph) => context.measureText(glyph).width)
      const reference = advances[0]
      return (
        reference !== undefined &&
        reference > 0 &&
        advances.every((advance) => Math.abs(advance - reference) < advanceTolerance)
      )
    })
  } catch {
    return true
  }
}
