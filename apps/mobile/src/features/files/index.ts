/** Mobile Files public feature boundary (FIL-006). */

export {
  pathFromSegments,
  pathSegments,
  pathTestId,
} from './file-paths'
export { FileViewer } from './file-viewer'
export { FilesBrowser } from './files-browser'
export { FilesCompanion, PinnedSection } from './files-companion'

export { FilesNotificationBridge } from './files-notification-bridge'
export { FilesPhoneScreen } from './files-phone-screen'
export { invalidateFilesEffects } from './files-query-filter'
export { useFilesStore } from './files-store'
export { FilesSurfacePanel } from './files-surface-panel'

export {
  markdownToHtml,
  previewDocument,
  readerDocument,
} from './preview-document'
export { openPreviewExternalLink } from './preview-open-link'
export { PreviewView } from './preview-view'
export { SourceLine } from './source-lines'
export type { SourceRow } from './source-rows'
export { describeBytes, sourceAnchorText } from './source-rows'
