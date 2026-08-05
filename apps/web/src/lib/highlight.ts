/** Re-export the shared Shiki setup — implementation in @porcelain/client-runtime. */
export {
  getHighlighter,
  HIGHLIGHT_THEMES,
  type Highlighter,
  type HighlightThemeName,
  isTokenizable,
  LANGS,
  languageFor,
  MAX_TOKENIZE_LINES,
  type TokenMap,
  themeNameFor,
  tokenizeHunks,
  tokenizeLines,
} from '@porcelain/client-runtime/highlight'
