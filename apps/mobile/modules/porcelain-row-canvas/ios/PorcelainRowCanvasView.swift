import ExpoModulesCore
import UIKit

/// A generic row surface: a vertical `UIScrollView` whose content is a single drawn canvas.
/// It knows rows, roles, tokens and a viewport — never what a row means. Feature semantics
/// (diff, terminal grid, log) live in the JS adapter that builds the row JSON.
public final class PorcelainRowCanvasView: ExpoView, UIScrollViewDelegate {
  private let scrollView = UIScrollView()
  private let canvas = RowCanvasContentView()
  private let refreshControl = UIRefreshControl()
  private let decodeQueue = DispatchQueue(label: "porcelain.row-canvas.decode", qos: .userInitiated)

  private var contentKey = ""
  private var tokensResetKey = ""
  private var rowsGeneration = 0
  private var lastVisibleRangeKey = ""
  private var pendingScrollRowId: String?
  private var pendingScrollAnimated = false

  let onVisibleRange = EventDispatcher()
  let onRowPress = EventDispatcher()
  let onRowLongPress = EventDispatcher()
  let onRefresh = EventDispatcher()

  public required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)

    clipsToBounds = true
    scrollView.delegate = self
    // The surface fills the screen under a translucent tab bar and the home indicator, so it
    // takes the safe area itself — nothing else inserts one for a UIKit view in this tree.
    scrollView.contentInsetAdjustmentBehavior = .always
    scrollView.alwaysBounceVertical = true
    scrollView.alwaysBounceHorizontal = false
    scrollView.showsHorizontalScrollIndicator = false
    refreshControl.addTarget(self, action: #selector(handleRefresh), for: .valueChanged)
    addSubview(scrollView)

    canvas.onRowPress = { [weak self] hit in
      self?.onRowPress(Self.payload(for: hit))
    }
    canvas.onRowLongPress = { [weak self] hit in
      self?.onRowLongPress(Self.payload(for: hit))
    }
    scrollView.addSubview(canvas)
    applyBackground()
  }

  private static func payload(for hit: RowCanvasHit) -> [String: Any] {
    [
      "rowId": hit.row.id,
      "index": hit.index,
      "charIndex": hit.charIndex,
      "inGutter": hit.inGutter,
    ]
  }

  public override func layoutSubviews() {
    super.layoutSubviews()
    scrollView.frame = bounds
    updateMetrics()
  }

  // MARK: - Scrolling

  public func scrollViewDidScroll(_ scrollView: UIScrollView) {
    syncViewport()
  }

  public func scrollViewDidEndDragging(_ scrollView: UIScrollView, willDecelerate decelerate: Bool) {
    if !decelerate { emitVisibleRange() }
  }

  public func scrollViewDidEndDecelerating(_ scrollView: UIScrollView) {
    emitVisibleRange()
  }

  public func scrollViewDidEndScrollingAnimation(_ scrollView: UIScrollView) {
    emitVisibleRange()
  }

  private func syncViewport() {
    canvas.frame = CGRect(
      x: 0,
      y: scrollView.contentOffset.y,
      width: max(bounds.width, 1),
      height: max(bounds.height, 1)
    )
    canvas.verticalOffset = scrollView.contentOffset.y
    canvas.invalidate()
  }

  private func updateMetrics() {
    scrollView.contentSize = CGSize(width: bounds.width, height: max(bounds.height, canvas.contentHeight))
    canvas.viewportWidth = bounds.width
    syncViewport()
    applyPendingScroll()
    emitVisibleRange()
  }

  private func emitVisibleRange() {
    guard let range = canvas.visibleRowRange() else { return }
    let key = "\(range.first):\(range.last)"
    guard key != lastVisibleRangeKey else { return }
    lastVisibleRangeKey = key

    onVisibleRange([
      "firstIndex": range.first,
      "lastIndex": range.last,
      "firstRowId": canvas.rows[range.first].id,
      "lastRowId": canvas.rows[range.last].id,
      "totalRows": canvas.rows.count,
    ])
  }

  private func applyBackground() {
    backgroundColor = canvas.theme.background
    scrollView.backgroundColor = canvas.theme.background
    canvas.backgroundColor = canvas.theme.background
  }

  @objc private func handleRefresh() {
    onRefresh([:])
  }

  // MARK: - Props

  /// Rows and token patches arrive through view functions, not props: Expo diffs prop strings on
  /// the main thread, so a megabyte of row JSON compared per render drops frames by itself.
  func setRowsJson(_ rowsJson: String) {
    rowsGeneration += 1
    let generation = rowsGeneration
    let key = contentKey

    decodeQueue.async { [weak self] in
      guard let data = rowsJson.data(using: .utf8) else { return }
      let decoded = try? JSONDecoder().decode([RowCanvasRow].self, from: data)
      DispatchQueue.main.async {
        guard let self, generation == self.rowsGeneration, key == self.contentKey else { return }
        self.canvas.rows = decoded ?? []
        self.lastVisibleRangeKey = ""
        self.updateMetrics()
      }
    }
  }

  func setTokensPatchJson(_ tokensPatchJson: String) {
    let key = tokensResetKey

    decodeQueue.async { [weak self] in
      guard let data = tokensPatchJson.data(using: .utf8),
        let patch = try? JSONDecoder().decode(RowCanvasTokensPatch.self, from: data),
        let tokens = patch.tokensByRowId, !tokens.isEmpty
      else { return }

      DispatchQueue.main.async {
        // A tokenizer pass started before a reset can land after it. Dropping the stale patch
        // is what keeps a previous document's colours off the current one.
        guard let self, key == self.tokensResetKey else { return }
        if let resetKey = patch.resetKey, resetKey != self.tokensResetKey { return }
        self.canvas.mergeTokens(tokens)
      }
    }
  }

  func setContentKey(_ contentKey: String) {
    guard contentKey != self.contentKey else { return }
    self.contentKey = contentKey
    rowsGeneration += 1
    canvas.rows = []
    canvas.tokensByRowId = [:]
    pendingScrollRowId = nil
    lastVisibleRangeKey = ""
    scrollView.setContentOffset(.zero, animated: false)
    updateMetrics()
  }

  func setTokensResetKey(_ tokensResetKey: String) {
    guard tokensResetKey != self.tokensResetKey else { return }
    self.tokensResetKey = tokensResetKey
    canvas.tokensByRowId = [:]
  }

  func setThemeJson(_ themeJson: String) {
    let payload = themeJson.data(using: .utf8).flatMap {
      try? JSONDecoder().decode(RowCanvasThemePayload.self, from: $0)
    }
    canvas.theme = RowCanvasTheme.resolve(payload)
    applyBackground()
    updateMetrics()
  }

  func setStateJson(_ stateJson: String) {
    let payload = stateJson.data(using: .utf8).flatMap {
      try? JSONDecoder().decode(RowCanvasStatePayload.self, from: $0)
    }
    canvas.collapsedRowIds = Set(payload?.collapsedRowIds ?? [])
    canvas.pinnedRowIds = Set(payload?.pinnedRowIds ?? [])
    canvas.selectedRowIds = Set(payload?.selectedRowIds ?? [])
    updateMetrics()
  }

  /// Off unless a caller handles `onRefresh`: a control nobody answers spins forever, because
  /// `refreshing` never changes and so its setter is never invoked again.
  func setRefreshEnabled(_ enabled: Bool) {
    if !enabled, refreshControl.isRefreshing { refreshControl.endRefreshing() }
    scrollView.refreshControl = enabled ? refreshControl : nil
  }

  func setRefreshing(_ refreshing: Bool) {
    if refreshing, !refreshControl.isRefreshing {
      refreshControl.beginRefreshing()
    } else if !refreshing, refreshControl.isRefreshing {
      refreshControl.endRefreshing()
    }
  }

  // MARK: - Imperative

  func scrollToRow(_ rowId: String, animated: Bool) {
    pendingScrollRowId = rowId
    pendingScrollAnimated = animated
    applyPendingScroll()
  }

  func scrollToTop(animated: Bool) {
    pendingScrollRowId = nil
    setVerticalOffset(0, animated: animated)
  }

  private func applyPendingScroll() {
    guard let rowId = pendingScrollRowId, bounds.height > 0 else { return }
    guard let index = canvas.index(ofRowId: rowId), let frame = canvas.frameForRow(at: index) else {
      if !canvas.rows.isEmpty { pendingScrollRowId = nil }
      return
    }
    let animated = pendingScrollAnimated
    pendingScrollRowId = nil
    setVerticalOffset(frame.minY, animated: animated)
  }

  private func setVerticalOffset(_ target: CGFloat, animated: Bool) {
    let maxOffset = max(scrollView.contentSize.height - scrollView.bounds.height, 0)
    let clamped = min(max(target, 0), maxOffset)
    scrollView.setContentOffset(CGPoint(x: 0, y: clamped), animated: animated)
    if !animated {
      syncViewport()
      emitVisibleRange()
    }
  }
}
