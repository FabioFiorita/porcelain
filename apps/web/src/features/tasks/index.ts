/**
 * Web Tasks feature public entry point.
 *
 * Other Web regions import this module only — never a Tasks implementation file.
 */

export { useTaskColumnsStore, visibleTaskColumns } from './tasks-columns-store'
export { TasksList } from './tasks-list'
export {
  MissingEnvironmentTargetError,
  type TaskEnvironmentTarget,
  taskTableIdentity,
  useTaskActions,
} from './tasks-mutations'
export {
  applyTasksNotification,
  invalidateAllTasks,
  useTasksNotificationSubscription,
} from './tasks-notifications'
export { type TasksView as TasksTableView, useTasks } from './tasks-queries'
export {
  isTasksTableQueryKey,
  tasksKeyForEnvironment,
  tasksTableQueryKey,
} from './tasks-query-key'
export { TasksQuickAdd } from './tasks-quick-add'
export { TasksTable } from './tasks-table'
export { TasksView } from './tasks-view'
