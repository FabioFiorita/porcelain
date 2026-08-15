/**
 * Web Tasks feature public entry point.
 *
 * Other Web regions import this module only — never a Tasks implementation file. The barrel
 * names exactly what leaves the feature: the sidebar panel, the Viewer table, and the session
 * subscription the shell mounts. Everything else is internal, and stays internal.
 */

export { TasksList } from './tasks-list'
export { invalidateAllTasks, useTasksNotificationSubscription } from './tasks-notifications'
export { TasksView } from './tasks-view'
