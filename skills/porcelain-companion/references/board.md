# Project board

Porcelain shows a per-repo todo/doing/done board of cards (features, bugs, chores, tasks). It's how the human **queues** work without spelling everything out in the terminal, and how you reflect progress back — a two-way channel. Read it to know what to build; keep it in sync as you work.

**Board vs Review:** Board = queue of cards. Review = **one active story** per repo. When you pick up a Doing card, start the Review with that title (`review set --name "…"`) — the app can hand off "Start Review" with the title prefilled for the agent prompt. Do **not** turn Review into a second kanban.

Talk to Porcelain through the bundled CLI at `~/.porcelain/porcelain` — installed automatically and kept fresh on every app launch. Run it from **inside the repo** and it targets that repo automatically (git toplevel of the cwd); add `--repo <absolute path>` only to point at a different checkout.

- `~/.porcelain/porcelain board list` → the board grouped by column, each card with an id, title, and body. Check it to pick up queued work.
- `~/.porcelain/porcelain board create --title <s> [--body <s>] [--status todo|doing|done]` → capture a task (defaults to the "todo" column).
- `~/.porcelain/porcelain board update --id <id> [--title <s>] [--body <s>]` → edit a card.
- `~/.porcelain/porcelain board move --id <id> --status todo|doing|done` → move a card to "doing" when you start it and "done" when you finish, so the human sees progress.
- `~/.porcelain/porcelain board delete --id <id>` → remove a card.

## How to use it

- When the human says "what's on my board", "what should I build next", or asks you to pick up queued work, run `board list` first.
- When you start a card, `board move` it to "doing", then open the **Review** (Intent-first `review set`); when you finish Execution + Evidence, move the card to "done" — keep the board honest so the human sees real-time progress.
- Capture follow-ups and tasks you discover with `board create` so nothing gets lost in the conversation.
