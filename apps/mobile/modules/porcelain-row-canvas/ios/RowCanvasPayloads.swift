import UIKit

/// The current JS/native wire model. Optional fields describe row kinds and styling channels, not
/// client-version variants.
struct RowCanvasRow: Decodable {
  let id: String
  let text: String?
  let cells: [RowCanvasCell]?
  let gutter: String?
  let indent: Int?
  let role: String?
  let sticky: Bool?
  let heightScale: Double?
  let ranges: [RowCanvasRange]?
}

struct RowCanvasCell: Decodable {
  let text: String
  let fg: String?
  let bg: String?
  let bold: Bool?
}

struct RowCanvasRange: Decodable {
  let start: Int
  let end: Int
  let role: String?
}

struct RowCanvasToken: Decodable {
  let text: String
  let color: String?
  let bold: Bool?
  let italic: Bool?
}

struct RowCanvasTokensPatch: Decodable {
  let resetKey: String?
  let tokensByRowId: [String: [RowCanvasToken]]?
}

struct RowCanvasStatePayload: Decodable {
  let collapsedRowIds: [String]?
  let pinnedRowIds: [String]?
  let selectedRowIds: [String]?
}

struct RowCanvasRolePayload: Decodable {
  let fg: String?
  let bg: String?
  let accent: String?
  let highlight: String?
}

struct RowCanvasThemePayload: Decodable {
  let background: String?
  let text: String?
  let mutedText: String?
  let border: String?
  let selection: String?
  let roles: [String: RowCanvasRolePayload]?
  let rowHeight: Double?
  let fontSize: Double?
  let fontWeight: String?
  let gutterFontSize: Double?
  let gutterWidth: Double?
  let accentBarWidth: Double?
  let contentPadding: Double?
  let maxContentWidth: Double?
}

struct RowCanvasRole {
  let foreground: UIColor?
  let background: UIColor?
  let accent: UIColor?
  let highlight: UIColor?
}

/// Colours and metrics resolved once per theme change. Roles are opaque strings on purpose —
/// the canvas never learns what "add" or "cursor" mean, only how to paint the role it is given.
struct RowCanvasTheme {
  let background: UIColor
  let text: UIColor
  let mutedText: UIColor
  let border: UIColor
  let selection: UIColor
  let roles: [String: RowCanvasRole]
  let rowHeight: CGFloat
  let fontSize: CGFloat
  let fontWeight: UIFont.Weight
  let gutterFontSize: CGFloat
  let gutterWidth: CGFloat
  let accentBarWidth: CGFloat
  let contentPadding: CGFloat
  let maxContentWidth: CGFloat

  static let fallback = RowCanvasTheme(
    background: UIColor.systemBackground,
    text: UIColor.label,
    mutedText: UIColor.secondaryLabel,
    border: UIColor.separator,
    selection: UIColor.tintColor.withAlphaComponent(0.22),
    roles: [:],
    rowHeight: 18,
    fontSize: 12,
    fontWeight: .regular,
    gutterFontSize: 10,
    gutterWidth: 44,
    accentBarWidth: 3,
    contentPadding: 8,
    maxContentWidth: 4000
  )

  static func resolve(_ payload: RowCanvasThemePayload?) -> RowCanvasTheme {
    guard let payload else { return fallback }
    return RowCanvasTheme(
      background: UIColor(rowCanvasHex: payload.background) ?? fallback.background,
      text: UIColor(rowCanvasHex: payload.text) ?? fallback.text,
      mutedText: UIColor(rowCanvasHex: payload.mutedText) ?? fallback.mutedText,
      border: UIColor(rowCanvasHex: payload.border) ?? fallback.border,
      selection: UIColor(rowCanvasHex: payload.selection) ?? fallback.selection,
      roles: (payload.roles ?? [:]).mapValues { role in
        RowCanvasRole(
          foreground: UIColor(rowCanvasHex: role.fg),
          background: UIColor(rowCanvasHex: role.bg),
          accent: UIColor(rowCanvasHex: role.accent),
          highlight: UIColor(rowCanvasHex: role.highlight)
        )
      },
      rowHeight: positive(payload.rowHeight, fallback.rowHeight),
      fontSize: positive(payload.fontSize, fallback.fontSize),
      fontWeight: weight(payload.fontWeight),
      gutterFontSize: positive(payload.gutterFontSize, fallback.gutterFontSize),
      gutterWidth: nonNegative(payload.gutterWidth, fallback.gutterWidth),
      accentBarWidth: nonNegative(payload.accentBarWidth, fallback.accentBarWidth),
      contentPadding: nonNegative(payload.contentPadding, fallback.contentPadding),
      maxContentWidth: positive(payload.maxContentWidth, fallback.maxContentWidth)
    )
  }

  func role(_ name: String?) -> RowCanvasRole? {
    guard let name else { return nil }
    return roles[name]
  }

  private static func positive(_ value: Double?, _ fallback: CGFloat) -> CGFloat {
    guard let value, value.isFinite, value > 0 else { return fallback }
    return CGFloat(value)
  }

  private static func nonNegative(_ value: Double?, _ fallback: CGFloat) -> CGFloat {
    guard let value, value.isFinite, value >= 0 else { return fallback }
    return CGFloat(value)
  }

  private static func weight(_ value: String?) -> UIFont.Weight {
    switch value?.lowercased() {
    case "light": return .light
    case "medium": return .medium
    case "semibold": return .semibold
    case "bold": return .bold
    default: return .regular
    }
  }
}

extension UIColor {
  convenience init?(rowCanvasHex hex: String?) {
    guard var value = hex?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
      return nil
    }
    if value.hasPrefix("#") {
      value.removeFirst()
    }
    guard value.count == 6 || value.count == 8 else { return nil }

    var raw: UInt64 = 0
    guard Scanner(string: value).scanHexInt64(&raw) else { return nil }

    if value.count == 8 {
      self.init(
        red: CGFloat((raw >> 24) & 0xff) / 255,
        green: CGFloat((raw >> 16) & 0xff) / 255,
        blue: CGFloat((raw >> 8) & 0xff) / 255,
        alpha: CGFloat(raw & 0xff) / 255
      )
      return
    }

    self.init(
      red: CGFloat((raw >> 16) & 0xff) / 255,
      green: CGFloat((raw >> 8) & 0xff) / 255,
      blue: CGFloat(raw & 0xff) / 255,
      alpha: 1
    )
  }
}
