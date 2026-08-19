/**
 * Web Tasks feature public entry point.
 *
 * Other Web regions import this module only — never a Tasks implementation file. The barrel
 * names exactly what leaves the feature: the new-task dialog, the menu-bar quick-add surface,
 * the Viewer table, the left-rail opener, and the session subscription the shell mounts. Everything else is internal.
 */

export { NewTaskDialog } from './new-task-dialog'
export { openTasksBoard } from './tasks-navigation'
export { QuickAddView } from './quick-add-view'
export { invalidateAllTasks, useTasksNotificationSubscription } from './tasks-notifications'
export { TasksView } from './tasks-view'
