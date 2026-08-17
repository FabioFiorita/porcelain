import { targetedTab } from '@renderer/stores/hub-tabs'
import { useTabsStore } from '@renderer/stores/tabs'
import { useUnreadStore } from '@renderer/stores/unread'

/** Open the daemon-wide Tasks board in the Viewer. Does not change Hub selection. */
export function openTasksBoard(): void {
  useTabsStore.getState().openTab(targetedTab('tasks', 'tasks', { title: 'Tasks' }, null))
  useUnreadStore.getState().clear('tasks')
}
