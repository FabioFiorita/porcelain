import { router } from 'expo-router'

/** The one cross-surface handoff seam: Review never grows a second diff or file viewer. */
export function openDiff(path: string): void {
  router.push({ params: { path, scope: 'working' }, pathname: '/file' })
}

/**
 * The Files detail route is supplied by the Files slice. Until it lands, keep the handoff on
 * Files' home rather than inventing a lightweight viewer inside Review. The path remains a query
 * param so the first route owner can fill in its typed detail target without changing callers.
 */
export function openFile(path: string): void {
  router.push({ params: { path }, pathname: '/(tabs)/(files)' })
}
