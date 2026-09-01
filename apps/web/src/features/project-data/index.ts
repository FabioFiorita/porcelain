/**
 * Web Project Data feature public entry point.
 *
 * All that remains on the client is query-key invalidation: the companion disposition
 * and git-visibility surfaces were removed with Settings → Data, and their daemon
 * procedures are reached through the CLI (`porcelain project …`), not the browser.
 */

export { invalidateAllProjectDataQueries } from './project-data-query-key'
