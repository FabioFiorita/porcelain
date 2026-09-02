import { sep } from 'node:path'

/**
 * Serialize a host-relative path for contracts and client identity.
 *
 * Absolute project roots stay native to their owning daemon, but relative paths are a
 * cross-runtime namespace and always use `/`. On Windows, `node:path.relative` returns `\\`;
 * allowing that onto the wire would make Files notifications and mutation results fail their
 * contracts and would give the same file a different cache key on each host.
 */
export function toWireRelativePath(path: string, hostSeparator = sep): string {
  return hostSeparator === '/' ? path : path.split(hostSeparator).join('/')
}
