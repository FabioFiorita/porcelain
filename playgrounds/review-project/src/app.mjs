const summary = document.querySelector('#summary');
const list = document.querySelector('#tasks');
try {
  const response = await fetch('/api/tasks');
  if (!response.ok) throw new Error('Unable to load tasks');
  const data = await response.json();
  summary.textContent = `${data.summary.done} of ${data.summary.total} tasks complete`;
  for (const task of data.tasks) {
    const card = document.createElement('article');
    const title = document.createElement('h2');
    title.textContent = task.title;
    const detail = document.createElement('p');
    detail.textContent = `${task.owner} · ${task.status}`;
    card.append(title, detail);
    list.append(card);
  }
} catch {
  summary.textContent = 'Tasks could not be loaded. Refresh to try again.';
}
