import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { summarizeTasks } from './src/task-store.mjs';

const assets = new Map([
  ['/', ['app.html', 'text/html']],
  ['/src/app.mjs', ['src/app.mjs', 'text/javascript']],
  ['/src/styles.css', ['src/styles.css', 'text/css']],
]);
const server = createServer(async (request, response) => {
  try {
    const tasks = JSON.parse(
      await readFile(new URL('./data/tasks.json', import.meta.url), 'utf8'),
    );
    if (request.url === '/api/tasks') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ tasks, summary: summarizeTasks(tasks) }));
      return;
    }
    const asset = assets.get(request.url);
    if (!asset) {
      response.writeHead(404).end('Not found');
      return;
    }
    response.writeHead(200, { 'content-type': asset[1] });
    response.end(await readFile(new URL(asset[0], import.meta.url)));
  } catch {
    response.writeHead(500).end('Unable to load demo data');
  }
});
server.listen(Number(process.argv[2] ?? 4100), '127.0.0.1', () => {
  console.log(`Fieldnotes: http://127.0.0.1:${server.address().port}`);
});
