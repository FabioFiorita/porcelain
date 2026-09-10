export function summarizeTasks(tasks) {
  return {
    total: tasks.length,
    done: tasks.filter((task) => task.status === 'done').length,
  };
}
