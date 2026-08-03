import UIKit

/// `CADisplayLink` retains its target, and the run loop retains the link — a canvas removed
/// mid-fling would outlive its screen. The proxy is what keeps that reference weak.
private final class RowCanvasDisplayLinkProxy: NSObject {
  weak var canvas: RowCanvasContentView?

  init(canvas: RowCanvasContentView) {
    self.canvas = canvas
  }

  @objc func step(_ link: CADisplayLink) {
    canvas?.stepDeceleration(link)
  }
}

struct RowCanvasHit {
  let index: Int
  let row: RowCanvasRow
  let charIndex: Int
  let inGutter: Bool
}

/// The canvas: one `UIView` that draws only the rows intersecting the viewport, positioned by
/// the scroll view above it. It owns no subviews and no cells — a row costs a `draw` call and a
/// cached offset, never a view, which is what lets the document be arbitrarily long.
final class RowCanvasContentView: UIView, UIGestureRecognizerDelegate {
  private static let maxCachedAttributedRows = 2000
  private static let maxCachedSymbols = 128

  var onRowPress: ((RowCanvasHit) -> Void)?
  var onRowLongPress: ((RowCanvasHit) -> Void)?

  var rows: [RowCanvasRow] = [] {
    didSet {
      stopDeceleration()
      horizontalOffset = 0
      // Row ids are positional, so the same id in a new document is a different line: keeping
      // its tokens would repaint the previous document's text. The visible window re-requests.
      tokensByRowId.removeAll()
      attributedByRowId.removeAll()
      rebuildLayout()
      setNeedsDisplay()
    }
  }

  var tokensByRowId: [String: [RowCanvasToken]] = [:] {
    didSet {
      attributedByRowId.removeAll()
      setNeedsDisplay()
    }
  }

  var theme = RowCanvasTheme.fallback {
    didSet {
      colorsByHex.removeAll()
      attributedByRowId.removeAll()
      symbolsByKey.removeAll()
      rebuildLayout()
      setNeedsDisplay()
    }
  }

  var collapsedRowIds: Set<String> = [] {
    didSet {
      rebuildLayout()
      setNeedsDisplay()
    }
  }

  var pinnedRowIds: Set<String> = [] {
    didSet { setNeedsDisplay() }
  }

  var selectedRowIds: Set<String> = [] {
    didSet { setNeedsDisplay() }
  }

  var viewportWidth: CGFloat = 0 {
    didSet {
      clampHorizontalOffset()
      setNeedsDisplay()
    }
  }

  var verticalOffset: CGFloat = 0

  private(set) var contentHeight: CGFloat = 0
  private var rowOffsets: [CGFloat] = []
  private var stickyRowIndices: [Int] = []
  private var contentWidth: CGFloat = 0
  private var characterWidth: CGFloat = 8
  private var horizontalOffset: CGFloat = 0
  private var panStartOffset: CGFloat = 0
  private var attributedByRowId: [String: NSAttributedString] = [:]
  private var colorsByHex: [String: UIColor] = [:]
  private var symbolsByKey: [String: UIImage] = [:]
  private var decelerationLink: CADisplayLink?
  private var decelerationProxy: RowCanvasDisplayLinkProxy?
  private var horizontalVelocity: CGFloat = 0
  private var lastDecelerationAt: CFTimeInterval = 0

  private lazy var panGesture: UIPanGestureRecognizer = {
    let gesture = UIPanGestureRecognizer(target: self, action: #selector(handlePan(_:)))
    gesture.delegate = self
    gesture.cancelsTouchesInView = false
    return gesture
  }()

  private lazy var tapGesture: UITapGestureRecognizer = {
    let gesture = UITapGestureRecognizer(target: self, action: #selector(handleTap(_:)))
    gesture.delegate = self
    gesture.cancelsTouchesInView = false
    return gesture
  }()

  private lazy var longPressGesture: UILongPressGestureRecognizer = {
    let gesture = UILongPressGestureRecognizer(target: self, action: #selector(handleLongPress(_:)))
    gesture.delegate = self
    gesture.cancelsTouchesInView = false
    gesture.minimumPressDuration = 0.3
    return gesture
  }()

  override init(frame: CGRect) {
    super.init(frame: frame)
    installGestures()
  }

  required init?(coder: NSCoder) {
    super.init(coder: coder)
    installGestures()
  }

  deinit {
    stopDeceleration()
  }

  private func installGestures() {
    isOpaque = true
    contentMode = .redraw
    isAccessibilityElement = false
    addGestureRecognizer(panGesture)
    addGestureRecognizer(longPressGesture)
    addGestureRecognizer(tapGesture)
    tapGesture.require(toFail: longPressGesture)
  }

  // MARK: - Layout

  private var codeStartX: CGFloat {
    theme.accentBarWidth + theme.gutterWidth + theme.contentPadding
  }

  private func height(for row: RowCanvasRow) -> CGFloat {
    if collapsedRowIds.contains(row.id) { return 0 }
    let scale = row.heightScale ?? 1
    guard scale.isFinite, scale > 0 else { return theme.rowHeight }
    return theme.rowHeight * CGFloat(scale)
  }

  private func rebuildLayout() {
    var offsets: [CGFloat] = []
    var sticky: [Int] = []
    offsets.reserveCapacity(rows.count)
    characterWidth = measureCharacterWidth()

    var offset: CGFloat = 0
    var maxColumns = 0
    for (index, row) in rows.enumerated() {
      offsets.append(offset)
      if row.sticky == true { sticky.append(index) }
      offset += height(for: row)
      maxColumns = max(maxColumns, columnCount(for: row))
    }

    rowOffsets = offsets
    stickyRowIndices = sticky
    contentHeight = offset
    contentWidth = min(
      theme.maxContentWidth,
      ceil(CGFloat(maxColumns) * characterWidth) + theme.contentPadding * 2
    )
    clampHorizontalOffset()
  }

  private func columnCount(for row: RowCanvasRow) -> Int {
    let leading = leadingColumns(for: row)
    if let cells = row.cells {
      return leading + cells.reduce(0) { $0 + $1.text.count }
    }
    return leading + (row.text?.count ?? 0)
  }

  /// Rows without symbols reserve nothing, so a diff document keeps its exact character grid.
  private func leadingColumns(for row: RowCanvasRow) -> Int {
    let symbols = row.symbols?.count ?? 0
    return max(0, row.indent ?? 0) + symbols * theme.symbolColumns
  }

  /// Where a row's text begins: past the gutter, its own indent, and its symbol slots.
  private func contentOriginX(for row: RowCanvasRow) -> CGFloat {
    codeStartX - horizontalOffset + CGFloat(leadingColumns(for: row)) * characterWidth
  }

  private var codeFont: UIFont {
    UIFont.monospacedSystemFont(ofSize: theme.fontSize, weight: theme.fontWeight)
  }

  private var gutterFont: UIFont {
    UIFont.monospacedSystemFont(ofSize: theme.gutterFontSize, weight: theme.fontWeight)
  }

  private func measureCharacterWidth() -> CGFloat {
    let sample = String(repeating: "0", count: 32)
    let width = (sample as NSString).size(withAttributes: [.font: codeFont, .ligature: 0]).width
    return width / 32
  }

  func frameForRow(at index: Int) -> CGRect? {
    guard rows.indices.contains(index), rowOffsets.indices.contains(index) else { return nil }
    return CGRect(
      x: 0,
      y: rowOffsets[index],
      width: max(viewportWidth, 1),
      height: height(for: rows[index])
    )
  }

  func index(ofRowId rowId: String) -> Int? {
    rows.firstIndex { $0.id == rowId }
  }

  func invalidate() {
    setNeedsDisplay()
  }

  func mergeTokens(_ patch: [String: [RowCanvasToken]]) {
    for (rowId, tokens) in patch {
      tokensByRowId[rowId] = tokens
      attributedByRowId.removeValue(forKey: rowId)
    }
    setNeedsDisplay()
  }

  // MARK: - Row lookup

  private func firstRowIndex(atOrAfter y: CGFloat) -> Int? {
    guard !rows.isEmpty else { return nil }
    var low = 0
    var high = rows.count
    while low < high {
      let mid = (low + high) / 2
      if rowOffsets[mid] + height(for: rows[mid]) < y {
        low = mid + 1
      } else {
        high = mid
      }
    }
    return low < rows.count ? low : nil
  }

  private func lastRowIndex(atOrBefore y: CGFloat) -> Int? {
    guard !rows.isEmpty else { return nil }
    var low = 0
    var high = rows.count
    while low < high {
      let mid = (low + high) / 2
      if rowOffsets[mid] <= y {
        low = mid + 1
      } else {
        high = mid
      }
    }
    return low > 0 ? low - 1 : nil
  }

  func visibleRowRange() -> (first: Int, last: Int)? {
    guard !rows.isEmpty,
      let first = firstRowIndex(atOrAfter: verticalOffset),
      let last = lastRowIndex(atOrBefore: verticalOffset + max(bounds.height, 1)),
      first <= last
    else { return nil }
    return (first, last)
  }

  private func rowIndex(atAbsoluteY y: CGFloat) -> Int? {
    guard let index = lastRowIndex(atOrBefore: y), rows.indices.contains(index) else { return nil }
    return y < rowOffsets[index] + height(for: rows[index]) ? index : nil
  }

  private func stickyTarget() -> (index: Int, rect: CGRect)? {
    guard !stickyRowIndices.isEmpty else { return nil }

    var low = 0
    var high = stickyRowIndices.count
    while low < high {
      let mid = (low + high) / 2
      if rowOffsets[stickyRowIndices[mid]] <= verticalOffset {
        low = mid + 1
      } else {
        high = mid
      }
    }

    let position = low - 1
    guard position >= 0 else { return nil }
    let index = stickyRowIndices[position]
    let rowHeight = height(for: rows[index])
    guard rowHeight > 0, rowOffsets[index] < verticalOffset else { return nil }

    var y: CGFloat = 0
    if stickyRowIndices.indices.contains(position + 1) {
      let next = stickyRowIndices[position + 1]
      y = min(0, rowOffsets[next] - verticalOffset - rowHeight)
    }
    guard y > -rowHeight else { return nil }

    return (index, CGRect(x: 0, y: y, width: max(bounds.width, viewportWidth), height: rowHeight))
  }

  // MARK: - Horizontal pan

  private var maxHorizontalOffset: CGFloat {
    max(0, contentWidth - max(0, viewportWidth - codeStartX))
  }

  private func clampHorizontalOffset() {
    horizontalOffset = min(max(horizontalOffset, 0), maxHorizontalOffset)
  }

  override func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
    guard gestureRecognizer === panGesture else { return true }
    let velocity = panGesture.velocity(in: self)
    guard abs(velocity.x) > abs(velocity.y) * 1.25 else { return false }
    if velocity.x > 0 && horizontalOffset <= 0.5 { return false }
    return maxHorizontalOffset > 0
  }

  func gestureRecognizer(
    _ gestureRecognizer: UIGestureRecognizer,
    shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer
  ) -> Bool {
    false
  }

  @objc private func handlePan(_ gesture: UIPanGestureRecognizer) {
    switch gesture.state {
    case .began:
      stopDeceleration()
      panStartOffset = horizontalOffset
    case .changed:
      horizontalOffset = min(
        max(panStartOffset - gesture.translation(in: self).x, 0),
        maxHorizontalOffset
      )
      setNeedsDisplay()
    case .ended:
      startDeceleration(velocity: -gesture.velocity(in: self).x)
    case .cancelled, .failed:
      clampHorizontalOffset()
      setNeedsDisplay()
    default:
      break
    }
  }

  private func startDeceleration(velocity: CGFloat) {
    guard abs(velocity) > 80 else { return }
    if (horizontalOffset <= 0 && velocity < 0) || (horizontalOffset >= maxHorizontalOffset && velocity > 0) {
      return
    }
    stopDeceleration()
    horizontalVelocity = velocity
    lastDecelerationAt = 0
    let proxy = RowCanvasDisplayLinkProxy(canvas: self)
    let link = CADisplayLink(target: proxy, selector: #selector(RowCanvasDisplayLinkProxy.step(_:)))
    link.add(to: .main, forMode: .common)
    decelerationProxy = proxy
    decelerationLink = link
  }

  override func willMove(toWindow newWindow: UIWindow?) {
    super.willMove(toWindow: newWindow)
    if newWindow == nil { stopDeceleration() }
  }

  fileprivate func stepDeceleration(_ link: CADisplayLink) {
    if lastDecelerationAt == 0 {
      lastDecelerationAt = link.timestamp
      return
    }
    let elapsed = max(0, link.timestamp - lastDecelerationAt)
    lastDecelerationAt = link.timestamp

    horizontalOffset = min(max(horizontalOffset + horizontalVelocity * CGFloat(elapsed), 0), maxHorizontalOffset)
    setNeedsDisplay()

    // UIScrollView's deceleration rate is expressed per millisecond.
    horizontalVelocity *= CGFloat(pow(Double(UIScrollView.DecelerationRate.normal.rawValue), elapsed * 1000))
    if abs(horizontalVelocity) < 20 || horizontalOffset <= 0 || horizontalOffset >= maxHorizontalOffset {
      stopDeceleration()
    }
  }

  private func stopDeceleration() {
    decelerationLink?.invalidate()
    decelerationLink = nil
    decelerationProxy = nil
    horizontalVelocity = 0
    lastDecelerationAt = 0
  }

  // MARK: - Touch

  private func hit(at point: CGPoint) -> RowCanvasHit? {
    if let sticky = stickyTarget(), sticky.rect.contains(point) {
      return hit(index: sticky.index, point: point)
    }
    guard let index = rowIndex(atAbsoluteY: verticalOffset + point.y) else { return nil }
    return hit(index: index, point: point)
  }

  private func hit(index: Int, point: CGPoint) -> RowCanvasHit {
    let row = rows[index]
    let inGutter = point.x < codeStartX
    let column = (point.x - codeStartX + horizontalOffset) / max(characterWidth, 1)
    let charIndex = max(0, Int(column.rounded(.down)) - leadingColumns(for: row))
    return RowCanvasHit(index: index, row: row, charIndex: inGutter ? 0 : charIndex, inGutter: inGutter)
  }

  @objc private func handleTap(_ gesture: UITapGestureRecognizer) {
    guard gesture.state == .ended, let target = hit(at: gesture.location(in: self)) else { return }
    onRowPress?(target)
  }

  @objc private func handleLongPress(_ gesture: UILongPressGestureRecognizer) {
    guard gesture.state == .began, let target = hit(at: gesture.location(in: self)) else { return }
    onRowLongPress?(target)
  }

  // MARK: - Accessibility

  /// The canvas draws text instead of building subviews, so VoiceOver would otherwise find one
  /// unlabelled rectangle. Elements cover the visible rows only and are built when accessibility
  /// asks for them, not on every scroll frame.
  override var accessibilityElements: [Any]? {
    get { visibleAccessibilityElements() }
    set {}
  }

  private func visibleAccessibilityElements() -> [Any] {
    guard let range = visibleRowRange() else { return [] }

    var elements: [UIAccessibilityElement] = []
    for index in range.first...range.last {
      let row = rows[index]
      let rowHeight = height(for: row)
      guard rowHeight > 0, let label = spokenLabel(for: row) else { continue }

      var traits: UIAccessibilityTraits = .button
      if row.sticky == true { traits.insert(.header) }

      let element = UIAccessibilityElement(accessibilityContainer: self)
      element.accessibilityLabel = label
      element.accessibilityTraits = traits
      element.accessibilityFrameInContainerSpace = CGRect(
        x: 0,
        y: rowOffsets[index] - verticalOffset,
        width: max(bounds.width, 1),
        height: rowHeight
      )
      elements.append(element)
    }
    return elements
  }

  /// `label` is what the adapter wants said ("src, folder, 12 items"); the drawn text is the
  /// fallback, and a row that is only whitespace is skipped rather than announced as blank.
  private func spokenLabel(for row: RowCanvasRow) -> String? {
    if let label = row.label, !label.isEmpty { return label }
    if let text = row.text, !text.trimmingCharacters(in: .whitespaces).isEmpty { return text }
    if let cells = row.cells {
      let joined = cells.map(\.text).joined()
      if !joined.trimmingCharacters(in: .whitespaces).isEmpty { return joined }
    }
    return nil
  }

  // MARK: - Drawing

  override func draw(_ rect: CGRect) {
    guard let context = UIGraphicsGetCurrentContext() else { return }

    theme.background.setFill()
    context.fill(rect)
    guard !rows.isEmpty else { return }

    let minY = verticalOffset + rect.minY
    let maxY = verticalOffset + rect.maxY
    let overscan = theme.rowHeight * 4
    guard let first = firstRowIndex(atOrAfter: max(0, minY - overscan)),
      let last = lastRowIndex(atOrBefore: maxY + overscan),
      first <= last
    else { return }

    for index in first...last {
      let rowHeight = height(for: rows[index])
      guard rowHeight > 0 else { continue }
      let top = rowOffsets[index]
      guard top + rowHeight >= minY, top <= maxY else { continue }
      draw(
        rows[index],
        in: CGRect(x: 0, y: top - verticalOffset, width: max(bounds.width, viewportWidth), height: rowHeight),
        context: context
      )
    }

    if let sticky = stickyTarget() {
      draw(rows[sticky.index], in: sticky.rect, context: context)
      theme.border.setFill()
      let hairline = 1 / UIScreen.main.scale
      context.fill(CGRect(x: 0, y: sticky.rect.maxY - hairline, width: sticky.rect.width, height: hairline))
    }
  }

  private func draw(_ row: RowCanvasRow, in rect: CGRect, context: CGContext) {
    let role = theme.role(row.role)
    let background = role?.background ?? theme.background
    background.setFill()
    context.fill(rect)

    if selectedRowIds.contains(row.id) || pinnedRowIds.contains(row.id) {
      theme.selection.setFill()
      context.fill(rect)
    }

    context.saveGState()
    context.clip(to: CGRect(x: codeStartX, y: rect.minY, width: max(0, viewportWidth - codeStartX), height: rect.height))
    drawRanges(row, in: rect, context: context)
    drawSymbols(row, in: rect, role: role)
    drawContent(row, in: rect, role: role)
    context.restoreGState()

    drawGutter(row, in: rect, role: role, background: background, context: context)
  }

  private func drawGutter(
    _ row: RowCanvasRow,
    in rect: CGRect,
    role: RowCanvasRole?,
    background: UIColor,
    context: CGContext
  ) {
    // The gutter is painted after the code area is unclipped, over its own opaque fill: that is
    // what makes horizontally panned text slide underneath it instead of across it.
    let gutterRect = CGRect(x: 0, y: rect.minY, width: codeStartX - theme.contentPadding, height: rect.height)
    background.setFill()
    context.fill(gutterRect)

    if let accent = role?.accent, theme.accentBarWidth > 0 {
      accent.setFill()
      context.fill(CGRect(x: 0, y: rect.minY, width: theme.accentBarWidth, height: rect.height))
    }

    guard let gutter = row.gutter, !gutter.isEmpty else { return }
    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = .right
    (gutter as NSString).draw(
      in: CGRect(
        x: theme.accentBarWidth,
        y: rect.midY - gutterFont.lineHeight / 2,
        width: max(0, theme.gutterWidth - 2),
        height: gutterFont.lineHeight
      ),
      withAttributes: [
        .font: gutterFont,
        .foregroundColor: theme.mutedText,
        .paragraphStyle: paragraph,
        .ligature: 0,
      ]
    )
  }

  private func drawRanges(_ row: RowCanvasRow, in rect: CGRect, context: CGContext) {
    guard let ranges = row.ranges, !ranges.isEmpty else { return }
    let origin = contentOriginX(for: row)
    let height = min(rect.height - 2, codeFont.lineHeight + 2)
    for range in ranges where range.end > range.start {
      guard let fill = theme.role(range.role)?.highlight ?? theme.role(row.role)?.highlight else {
        continue
      }
      fill.setFill()
      let x = origin + CGFloat(range.start) * characterWidth
      let width = max(2, CGFloat(range.end - range.start) * characterWidth)
      UIBezierPath(
        roundedRect: CGRect(x: x, y: rect.midY - height / 2, width: width, height: height),
        cornerRadius: 3
      ).fill()
    }
  }

  /// The leading glyphs, each centred in its own reserved slot so the text column stays straight.
  /// Drawn in the same clipped region as the content, so they pan with the row rather than over
  /// the gutter.
  private func drawSymbols(_ row: RowCanvasRow, in rect: CGRect, role: RowCanvasRole?) {
    guard let symbols = row.symbols, !symbols.isEmpty, theme.symbolColumns > 0 else { return }

    let slot = CGFloat(theme.symbolColumns) * characterWidth
    // A trailing gap inside each slot keeps a glyph from crowding whatever follows it.
    let usable = max(slot - characterWidth * 0.5, 1)
    var x = codeStartX - horizontalOffset + CGFloat(max(0, row.indent ?? 0)) * characterWidth

    for symbol in symbols {
      defer { x += slot }
      guard !symbol.name.isEmpty else { continue }
      let tint = color(symbol.tint) ?? role?.foreground ?? theme.mutedText
      guard let image = symbolImage(name: symbol.name, tint: tint) else { continue }

      let scale = min(1, usable / max(image.size.width, 1))
      let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
      image.draw(
        in: CGRect(
          x: x + max(0, (usable - size.width) / 2),
          y: rect.midY - size.height / 2,
          width: size.width,
          height: size.height
        )
      )
    }
  }

  /// Keyed on the resolved colour, not the row's `tint` string: a row that leaves the tint out
  /// takes its role's foreground, and two roles must not share one cached glyph.
  private func symbolImage(name: String, tint: UIColor) -> UIImage? {
    let cacheKey = "\(name)|\(tint.hashValue)|\(theme.fontSize)"
    if let cached = symbolsByKey[cacheKey] { return cached }
    let configuration = UIImage.SymbolConfiguration(pointSize: theme.fontSize, weight: .regular)
    guard let base = UIImage(systemName: name, withConfiguration: configuration) else { return nil }
    let image = base.withTintColor(tint, renderingMode: .alwaysOriginal)
    if symbolsByKey.count >= Self.maxCachedSymbols { symbolsByKey.removeAll() }
    symbolsByKey[cacheKey] = image
    return image
  }

  private func drawContent(_ row: RowCanvasRow, in rect: CGRect, role: RowCanvasRole?) {
    let origin = CGPoint(x: contentOriginX(for: row), y: rect.midY - codeFont.lineHeight / 2)
    let foreground = role?.foreground ?? theme.text

    if let attributed = attributedContent(row, foreground: foreground) {
      attributed.draw(at: origin)
      return
    }

    guard let text = row.text, !text.isEmpty else { return }
    (text as NSString).draw(
      at: origin,
      withAttributes: [.font: codeFont, .foregroundColor: foreground, .ligature: 0]
    )
  }

  private func attributedContent(_ row: RowCanvasRow, foreground: UIColor) -> NSAttributedString? {
    if let cached = attributedByRowId[row.id] { return cached }

    let built: NSAttributedString?
    if let tokens = tokensByRowId[row.id], !tokens.isEmpty {
      built = attributed(tokens: tokens, foreground: foreground)
    } else if let cells = row.cells, !cells.isEmpty {
      built = attributed(cells: cells, foreground: foreground)
    } else {
      built = nil
    }

    if let built {
      // Bounded: the cache is a scroll accelerator, not a second copy of the document.
      if attributedByRowId.count >= Self.maxCachedAttributedRows { attributedByRowId.removeAll() }
      attributedByRowId[row.id] = built
    }
    return built
  }

  private func attributed(tokens: [RowCanvasToken], foreground: UIColor) -> NSAttributedString {
    let string = NSMutableAttributedString()
    for token in tokens where !token.text.isEmpty {
      string.append(
        NSAttributedString(
          string: token.text,
          attributes: [
            .font: font(bold: token.bold == true, italic: token.italic == true),
            .foregroundColor: color(token.color) ?? foreground,
            .ligature: 0,
          ]
        )
      )
    }
    return string
  }

  private func attributed(cells: [RowCanvasCell], foreground: UIColor) -> NSAttributedString {
    let string = NSMutableAttributedString()
    for cell in cells where !cell.text.isEmpty {
      var attributes: [NSAttributedString.Key: Any] = [
        .font: font(bold: cell.bold == true, italic: false),
        .foregroundColor: color(cell.fg) ?? foreground,
        .ligature: 0,
      ]
      if let background = color(cell.bg) {
        attributes[.backgroundColor] = background
      }
      string.append(NSAttributedString(string: cell.text, attributes: attributes))
    }
    return string
  }

  private func font(bold: Bool, italic: Bool) -> UIFont {
    let base = UIFont.monospacedSystemFont(
      ofSize: theme.fontSize,
      weight: bold ? .bold : theme.fontWeight
    )
    guard italic, let descriptor = base.fontDescriptor.withSymbolicTraits(.traitItalic) else {
      return base
    }
    return UIFont(descriptor: descriptor, size: theme.fontSize)
  }

  private func color(_ hex: String?) -> UIColor? {
    guard let hex, !hex.isEmpty else { return nil }
    if let cached = colorsByHex[hex] { return cached }
    guard let resolved = UIColor(rowCanvasHex: hex) else { return nil }
    colorsByHex[hex] = resolved
    return resolved
  }
}
