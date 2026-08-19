/**
 * Cell-exact drawing for block, shade, and box-drawing characters.
 *
 * The grid's row height is a line height (`fontSize * 1.35`), not the font's own em box, so a
 * font glyph painted with `fillText` never reaches the cell's edges: `█` stacked over `█` leaves
 * a horizontal seam, and `│` breaks between rows. Terminals solve this by drawing these
 * characters themselves; this module is that renderer. Every shape is expressed in cell
 * coordinates, so it tiles at any font size, line height, or face.
 *
 * Coverage is deliberate: U+2580–U+259F (blocks, eighths, shades, quadrants) and the solid
 * U+2500–U+257F box-drawing lines, corners, tees and crosses in light, heavy and double weight,
 * plus the rounded corners. Dashed, diagonal and other decorative forms fall through to the font,
 * where a seam is not a tiling failure.
 */

/** The cell to fill, in device-independent canvas units. Edges come from column boundaries. */
export interface GlyphCellRect {
  readonly left: number
  readonly right: number
  readonly top: number
  readonly bottom: number
}

const NONE = 0
const LIGHT = 1
const HEAVY = 2
const DOUBLE = 3

/** `[up, right, down, left]` line weights for a box-drawing character. */
type Edges = readonly [number, number, number, number]

/** Rounded corners: `[up, right, down, left]` plus the arc flag. */
const ROUNDED = new Set([0x256d, 0x256e, 0x256f, 0x2570])

const BOX_EDGES = new Map<number, Edges>([
  // Straight lines.
  [0x2500, [NONE, LIGHT, NONE, LIGHT]],
  [0x2501, [NONE, HEAVY, NONE, HEAVY]],
  [0x2502, [LIGHT, NONE, LIGHT, NONE]],
  [0x2503, [HEAVY, NONE, HEAVY, NONE]],
  // Corners, light/heavy mixes follow the Unicode naming order (down/right first).
  [0x250c, [NONE, LIGHT, LIGHT, NONE]],
  [0x250d, [NONE, HEAVY, LIGHT, NONE]],
  [0x250e, [NONE, LIGHT, HEAVY, NONE]],
  [0x250f, [NONE, HEAVY, HEAVY, NONE]],
  [0x2510, [NONE, NONE, LIGHT, LIGHT]],
  [0x2511, [NONE, NONE, LIGHT, HEAVY]],
  [0x2512, [NONE, NONE, HEAVY, LIGHT]],
  [0x2513, [NONE, NONE, HEAVY, HEAVY]],
  [0x2514, [LIGHT, LIGHT, NONE, NONE]],
  [0x2515, [LIGHT, HEAVY, NONE, NONE]],
  [0x2516, [HEAVY, LIGHT, NONE, NONE]],
  [0x2517, [HEAVY, HEAVY, NONE, NONE]],
  [0x2518, [LIGHT, NONE, NONE, LIGHT]],
  [0x2519, [LIGHT, NONE, NONE, HEAVY]],
  [0x251a, [HEAVY, NONE, NONE, LIGHT]],
  [0x251b, [HEAVY, NONE, NONE, HEAVY]],
  // Tees.
  [0x251c, [LIGHT, LIGHT, LIGHT, NONE]],
  [0x251d, [LIGHT, HEAVY, LIGHT, NONE]],
  [0x251e, [HEAVY, LIGHT, LIGHT, NONE]],
  [0x251f, [LIGHT, LIGHT, HEAVY, NONE]],
  [0x2520, [HEAVY, LIGHT, HEAVY, NONE]],
  [0x2521, [HEAVY, HEAVY, LIGHT, NONE]],
  [0x2522, [LIGHT, HEAVY, HEAVY, NONE]],
  [0x2523, [HEAVY, HEAVY, HEAVY, NONE]],
  [0x2524, [LIGHT, NONE, LIGHT, LIGHT]],
  [0x2525, [LIGHT, NONE, LIGHT, HEAVY]],
  [0x2526, [HEAVY, NONE, LIGHT, LIGHT]],
  [0x2527, [LIGHT, NONE, HEAVY, LIGHT]],
  [0x2528, [HEAVY, NONE, HEAVY, LIGHT]],
  [0x2529, [HEAVY, NONE, LIGHT, HEAVY]],
  [0x252a, [LIGHT, NONE, HEAVY, HEAVY]],
  [0x252b, [HEAVY, NONE, HEAVY, HEAVY]],
  [0x252c, [NONE, LIGHT, LIGHT, LIGHT]],
  [0x252d, [NONE, LIGHT, LIGHT, HEAVY]],
  [0x252e, [NONE, HEAVY, LIGHT, LIGHT]],
  [0x252f, [NONE, HEAVY, LIGHT, HEAVY]],
  [0x2530, [NONE, LIGHT, HEAVY, LIGHT]],
  [0x2531, [NONE, LIGHT, HEAVY, HEAVY]],
  [0x2532, [NONE, HEAVY, HEAVY, LIGHT]],
  [0x2533, [NONE, HEAVY, HEAVY, HEAVY]],
  [0x2534, [LIGHT, LIGHT, NONE, LIGHT]],
  [0x2535, [LIGHT, LIGHT, NONE, HEAVY]],
  [0x2536, [LIGHT, HEAVY, NONE, LIGHT]],
  [0x2537, [LIGHT, HEAVY, NONE, HEAVY]],
  [0x2538, [HEAVY, LIGHT, NONE, LIGHT]],
  [0x2539, [HEAVY, LIGHT, NONE, HEAVY]],
  [0x253a, [HEAVY, HEAVY, NONE, LIGHT]],
  [0x253b, [HEAVY, HEAVY, NONE, HEAVY]],
  // Crosses.
  [0x253c, [LIGHT, LIGHT, LIGHT, LIGHT]],
  [0x253d, [LIGHT, LIGHT, LIGHT, HEAVY]],
  [0x253e, [LIGHT, HEAVY, LIGHT, LIGHT]],
  [0x253f, [LIGHT, HEAVY, LIGHT, HEAVY]],
  [0x2540, [HEAVY, LIGHT, LIGHT, LIGHT]],
  [0x2541, [LIGHT, LIGHT, HEAVY, LIGHT]],
  [0x2542, [HEAVY, LIGHT, HEAVY, LIGHT]],
  [0x2543, [HEAVY, LIGHT, LIGHT, HEAVY]],
  [0x2544, [HEAVY, HEAVY, LIGHT, LIGHT]],
  [0x2545, [LIGHT, LIGHT, HEAVY, HEAVY]],
  [0x2546, [LIGHT, HEAVY, HEAVY, LIGHT]],
  [0x2547, [HEAVY, HEAVY, LIGHT, HEAVY]],
  [0x2548, [LIGHT, HEAVY, HEAVY, HEAVY]],
  [0x2549, [HEAVY, LIGHT, HEAVY, HEAVY]],
  [0x254a, [HEAVY, HEAVY, HEAVY, LIGHT]],
  [0x254b, [HEAVY, HEAVY, HEAVY, HEAVY]],
  // Double lines and their light mixes.
  [0x2550, [NONE, DOUBLE, NONE, DOUBLE]],
  [0x2551, [DOUBLE, NONE, DOUBLE, NONE]],
  [0x2552, [NONE, DOUBLE, LIGHT, NONE]],
  [0x2553, [NONE, LIGHT, DOUBLE, NONE]],
  [0x2554, [NONE, DOUBLE, DOUBLE, NONE]],
  [0x2555, [NONE, NONE, LIGHT, DOUBLE]],
  [0x2556, [NONE, NONE, DOUBLE, LIGHT]],
  [0x2557, [NONE, NONE, DOUBLE, DOUBLE]],
  [0x2558, [LIGHT, DOUBLE, NONE, NONE]],
  [0x2559, [DOUBLE, LIGHT, NONE, NONE]],
  [0x255a, [DOUBLE, DOUBLE, NONE, NONE]],
  [0x255b, [LIGHT, NONE, NONE, DOUBLE]],
  [0x255c, [DOUBLE, NONE, NONE, LIGHT]],
  [0x255d, [DOUBLE, NONE, NONE, DOUBLE]],
  [0x255e, [LIGHT, DOUBLE, LIGHT, NONE]],
  [0x255f, [DOUBLE, LIGHT, DOUBLE, NONE]],
  [0x2560, [DOUBLE, DOUBLE, DOUBLE, NONE]],
  [0x2561, [LIGHT, NONE, LIGHT, DOUBLE]],
  [0x2562, [DOUBLE, NONE, DOUBLE, LIGHT]],
  [0x2563, [DOUBLE, NONE, DOUBLE, DOUBLE]],
  [0x2564, [NONE, DOUBLE, LIGHT, DOUBLE]],
  [0x2565, [NONE, LIGHT, DOUBLE, LIGHT]],
  [0x2566, [NONE, DOUBLE, DOUBLE, DOUBLE]],
  [0x2567, [LIGHT, DOUBLE, NONE, DOUBLE]],
  [0x2568, [DOUBLE, LIGHT, NONE, LIGHT]],
  [0x2569, [DOUBLE, DOUBLE, NONE, DOUBLE]],
  [0x256a, [LIGHT, DOUBLE, LIGHT, DOUBLE]],
  [0x256b, [DOUBLE, LIGHT, DOUBLE, LIGHT]],
  [0x256c, [DOUBLE, DOUBLE, DOUBLE, DOUBLE]],
  // Rounded corners draw as arcs, but the same edges drive their endpoints.
  [0x256d, [NONE, LIGHT, LIGHT, NONE]],
  [0x256e, [NONE, NONE, LIGHT, LIGHT]],
  [0x256f, [LIGHT, NONE, NONE, LIGHT]],
  [0x2570, [LIGHT, LIGHT, NONE, NONE]],
  // Half-length stubs.
  [0x2574, [NONE, NONE, NONE, LIGHT]],
  [0x2575, [LIGHT, NONE, NONE, NONE]],
  [0x2576, [NONE, LIGHT, NONE, NONE]],
  [0x2577, [NONE, NONE, LIGHT, NONE]],
  [0x2578, [NONE, NONE, NONE, HEAVY]],
  [0x2579, [HEAVY, NONE, NONE, NONE]],
  [0x257a, [NONE, HEAVY, NONE, NONE]],
  [0x257b, [NONE, NONE, HEAVY, NONE]],
])

/** True when this module owns the character, so the caller must not fold it into a text run. */
export function isGhosttyCustomGlyph(text: string): boolean {
  if (text.length === 0) return false
  const code = text.codePointAt(0)
  if (code === undefined || text.length !== String.fromCodePoint(code).length) return false
  if (code >= 0x2580 && code <= 0x259f) return true
  return BOX_EDGES.has(code)
}

/**
 * Fill snapped to whole device pixels. A cell advance is usually fractional (7.2px), so two
 * abutting rects would each antialias against the background and leave a visible hairline between
 * them. Snapping the shared edge the same way from both sides makes neighbours meet exactly.
 */
function fill(
  context: CanvasRenderingContext2D,
  left: number,
  top: number,
  right: number,
  bottom: number,
): void {
  if (right <= left || bottom <= top) return
  const transform = typeof context.getTransform === 'function' ? context.getTransform() : null
  const scaleX = transform !== null && transform.a > 0 ? transform.a : 1
  const scaleY = transform !== null && transform.d > 0 ? transform.d : 1
  const snapLeft = Math.round(left * scaleX) / scaleX
  const snapTop = Math.round(top * scaleY) / scaleY
  // A shape thinner than a device pixel still has to show: round it up rather than away.
  const width = Math.max(1 / scaleX, Math.round(right * scaleX) / scaleX - snapLeft)
  const height = Math.max(1 / scaleY, Math.round(bottom * scaleY) / scaleY - snapTop)
  context.fillRect(snapLeft, snapTop, width, height)
}

/** Blocks and eighths: exact fractions of the cell, so neighbours share an edge. */
function drawBlock(context: CanvasRenderingContext2D, code: number, rect: GlyphCellRect): boolean {
  const { left, right, top, bottom } = rect
  const width = right - left
  const height = bottom - top
  const eighthUp = (n: number) => bottom - (height * n) / 8
  const eighthRight = (n: number) => left + (width * n) / 8
  if (code === 0x2580) {
    fill(context, left, top, right, top + height / 2)
    return true
  }
  if (code >= 0x2581 && code <= 0x2588) {
    // U+2581…U+2588 grow upwards from the bottom edge in eighths.
    fill(context, left, eighthUp(code - 0x2580), right, bottom)
    return true
  }
  if (code >= 0x2589 && code <= 0x258f) {
    // U+2589…U+258F shrink from seven eighths to one, measured from the left edge.
    fill(context, left, top, eighthRight(0x2590 - code), bottom)
    return true
  }
  if (code === 0x2590) {
    fill(context, left + width / 2, top, right, bottom)
    return true
  }
  if (code === 0x2594) {
    fill(context, left, top, right, top + height / 8)
    return true
  }
  if (code === 0x2595) {
    fill(context, right - width / 8, top, right, bottom)
    return true
  }
  return false
}

/** Quadrants: which of the four half-cells the character lights up. */
const QUADRANTS = new Map<number, readonly [boolean, boolean, boolean, boolean]>([
  // [upper-left, upper-right, lower-left, lower-right]
  [0x2596, [false, false, true, false]],
  [0x2597, [false, false, false, true]],
  [0x2598, [true, false, false, false]],
  [0x2599, [true, false, true, true]],
  [0x259a, [true, false, false, true]],
  [0x259b, [true, true, true, false]],
  [0x259c, [true, true, false, true]],
  [0x259d, [false, true, false, false]],
  [0x259e, [false, true, true, false]],
  [0x259f, [false, true, true, true]],
])

function drawQuadrant(
  context: CanvasRenderingContext2D,
  code: number,
  rect: GlyphCellRect,
): boolean {
  const quadrants = QUADRANTS.get(code)
  if (quadrants === undefined) return false
  const midX = (rect.left + rect.right) / 2
  const midY = (rect.top + rect.bottom) / 2
  const [upperLeft, upperRight, lowerLeft, lowerRight] = quadrants
  if (upperLeft) fill(context, rect.left, rect.top, midX, midY)
  if (upperRight) fill(context, midX, rect.top, rect.right, midY)
  if (lowerLeft) fill(context, rect.left, midY, midX, rect.bottom)
  if (lowerRight) fill(context, midX, midY, rect.right, rect.bottom)
  return true
}

/** A rail's drawn spans along its axis, given which branches exist and whether it is interrupted. */
function railSpans(
  near: boolean,
  far: boolean,
  interrupted: boolean,
  start: number,
  end: number,
  innerNear: number,
  innerFar: number,
): readonly (readonly [number, number])[] {
  if (near && far) {
    return interrupted
      ? [
          [start, innerNear],
          [innerFar, end],
        ]
      : [[start, end]]
  }
  if (near) return [[start, interrupted ? innerNear : innerFar]]
  if (far) return [[interrupted ? innerFar : innerNear, end]]
  return []
}

interface LineGeometry {
  readonly light: number
  readonly heavy: number
  readonly offset: number
}

function lineGeometry(cellWidth: number): LineGeometry {
  const light = Math.max(1, Math.round(cellWidth / 8))
  return { light, heavy: light * 2, offset: light * 2 }
}

function strokeWidth(weight: number, geometry: LineGeometry): number {
  return weight === HEAVY ? geometry.heavy : geometry.light
}

/** Solid lines, corners, tees and crosses, drawn from the cell edges into the centre. */
function drawBoxDrawing(
  context: CanvasRenderingContext2D,
  code: number,
  rect: GlyphCellRect,
): boolean {
  const edges = BOX_EDGES.get(code)
  if (edges === undefined) return false
  const [up, right, down, left] = edges
  const geometry = lineGeometry(rect.right - rect.left)
  const centreX = (rect.left + rect.right) / 2
  const centreY = (rect.top + rect.bottom) / 2
  const { offset } = geometry

  if (ROUNDED.has(code)) {
    drawRoundedCorner(context, edges, rect, geometry)
    return true
  }

  // Double-weight axes draw two rails; a rail is interrupted where a branch leaves on its side.
  if (up === DOUBLE || down === DOUBLE) {
    for (const side of [-1, 1] as const) {
      const x = centreX + side * offset
      const interrupted = (side === -1 ? left : right) !== NONE
      for (const [from, to] of railSpans(
        up !== NONE,
        down !== NONE,
        interrupted,
        rect.top,
        rect.bottom,
        centreY - offset,
        centreY + offset,
      )) {
        fill(context, x - geometry.light / 2, from, x + geometry.light / 2, to)
      }
    }
  } else if (up !== NONE || down !== NONE) {
    const half = strokeWidth(up !== NONE ? up : down, geometry) / 2
    const top = up !== NONE ? rect.top : centreY - half
    const bottom = down !== NONE ? rect.bottom : centreY + half
    fill(context, centreX - half, top, centreX + half, bottom)
  }

  if (left === DOUBLE || right === DOUBLE) {
    for (const side of [-1, 1] as const) {
      const y = centreY + side * offset
      const interrupted = (side === -1 ? up : down) !== NONE
      for (const [from, to] of railSpans(
        left !== NONE,
        right !== NONE,
        interrupted,
        rect.left,
        rect.right,
        centreX - offset,
        centreX + offset,
      )) {
        fill(context, from, y - geometry.light / 2, to, y + geometry.light / 2)
      }
    }
  } else if (left !== NONE || right !== NONE) {
    const half = strokeWidth(left !== NONE ? left : right, geometry) / 2
    const from = left !== NONE ? rect.left : centreX - half
    const to = right !== NONE ? rect.right : centreX + half
    fill(context, from, centreY - half, to, centreY + half)
  }
  return true
}

function drawRoundedCorner(
  context: CanvasRenderingContext2D,
  edges: Edges,
  rect: GlyphCellRect,
  geometry: LineGeometry,
): void {
  const [, right, down] = edges
  const centreX = (rect.left + rect.right) / 2
  const centreY = (rect.top + rect.bottom) / 2
  const endX = right !== NONE ? rect.right : rect.left
  const endY = down !== NONE ? rect.bottom : rect.top
  context.save()
  context.beginPath()
  context.lineWidth = geometry.light
  context.strokeStyle = context.fillStyle
  context.lineCap = 'butt'
  // Enter on the vertical branch's edge, bend around the centre, leave on the horizontal edge.
  context.moveTo(centreX, endY)
  context.quadraticCurveTo(centreX, centreY, endX, centreY)
  context.stroke()
  context.restore()
}

/**
 * Draw `text` as a geometric shape filling exactly `rect`. Returns false when the character is not
 * one this module owns, in which case the caller falls back to the font.
 */
export function drawGhosttyCustomGlyph(
  context: CanvasRenderingContext2D,
  text: string,
  rect: GlyphCellRect,
  color: string,
): boolean {
  if (!isGhosttyCustomGlyph(text)) return false
  const code = text.codePointAt(0)
  if (code === undefined) return false
  context.save()
  context.fillStyle = color
  let drawn = false
  if (code >= 0x2591 && code <= 0x2593) {
    // Shades tint the already-painted background; the cell is opaque underneath.
    context.globalAlpha = (code - 0x2590) / 4
    fill(context, rect.left, rect.top, rect.right, rect.bottom)
    drawn = true
  } else if (code >= 0x2580 && code <= 0x2595) {
    drawn = drawBlock(context, code, rect)
  } else if (code >= 0x2596 && code <= 0x259f) {
    drawn = drawQuadrant(context, code, rect)
  } else {
    drawn = drawBoxDrawing(context, code, rect)
  }
  context.restore()
  return drawn
}
