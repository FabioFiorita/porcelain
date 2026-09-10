# Fieldnotes

A small task board for a team preparing a product launch. The project is a
runnable development fixture with a browser UI, a JSON endpoint, domain rules,
styles, sample data and Node tests. No install or external account is needed.

Run `node server.mjs`, then open http://127.0.0.1:4100.
Run `node --test tests/task-store.spec.mjs` to check the task summary rules.
Run `node server.mjs 0` to choose an available port. Ctrl+C stops the sample application.

Tasks are demo data; restarting resets the application. Porcelain does not
launch this server automatically.
