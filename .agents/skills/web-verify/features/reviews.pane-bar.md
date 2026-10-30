---
route: /
selectors:
  - 'Open documents'
  - 'Document controls'
  - 'Reviewed'
  - 'Comment'
  - 'Timeline'
  - 'Copy hash'
  - 'Open in graph'
  - 'Git actions'
  - 'Compare'
  - 'Worktree navigator and document panes'
  - 'Document panes and side panel'
  - 'Left and right document panes'
  - 'Top and bottom document panes'
tests:
  - apps/web/spec/integration/reviews-pane-bar.test.tsx
  - apps/web/spec/integration/reviews-nontext-actions.test.tsx
  - apps/web/spec/integration/reviews-split-shortcuts.test.tsx
  - apps/web/spec/integration/reviews-all-changes.test.tsx
api:
  - GET /api/worktrees/:worktreeId/review
  - GET /api/worktrees/:worktreeId/changes
---

# reviews.pane-bar

Each pane has one 48px bar. Review, or Changes without a publication, stays first and cannot close. Active document controls belong to that pane; Git appears only in the rightmost bar. A side pane closes when its last closable document closes.

## How to get to it (user POV)

- Open any worktree. Files and History open documents alongside the permanent first tab.
- Right-click a document tab for its pin, close and side-opening actions.
- Use the tabs' keyboard shortcuts to step, close or split the focused document.

## Driving it with browser

1. At 1440 and 414, in light and dark, open a worktree without a review. Changes is the first chip (28px tall, stock Mira corners), with its uncommitted file count, no Close Changes button, the tooltip "Changes · n uncommitted files" and the accessible description "n uncommitted files". Document controls hold the tablist "Compare" (Uncommitted, Branch; icons with tooltips in a narrow pane), which shows the same uncommitted or branch changes the Review panel's tabs choose. Attempt Alt+W and the tab menu's Close: the tab remains.
2. Focus the Changes tab and publish a review. The same first tab stays mounted and keeps keyboard focus while its label changes to Review. Review replaces Changes and shows a tabular reviewed/total decision count that stays complete on one line, including 0/20 at 414; its tooltip is "Review · n of N decisions reviewed" and its accessible description "n of N decisions reviewed". With an agent summary, Walkthrough and Agent summary appear in Document controls; without one the switch is absent. Progress appears only in a wide pane.
3. Open a file, commit and graph. File controls include Reviewed, Comment and Timeline; a commit offers Copy hash and Open in graph; the graph has no document controls. Pane-bar action buttons use the stock 28px Mira default/icon sizes. Git primary and menu match Reviewed, Comment and Timeline; the primary is square when its label folds. Check these heights at 1440, 1080 and 414. Narrow controls use icons and tooltips. When those controls arrive or the pane narrows, the selected document chip stays inside the visible tab strip; manually scrolling still reaches the other tabs. Full file editing, parent selection and Copy message remain reachable. A non-text change keeps working Reviewed and Comment controls, including R and C, and Timeline in the pane bar; Open file and Discard remain reachable in its content. Changes with several files keep their per-file inline controls.
4. Inspect the accessibility tree at 1440: the navigator separator is named "Worktree navigator and document panes" and the docked panel separator is named "Document panes and side panel". Hidden navigator/panel layouts expose no corresponding separator. Tab to each separator and resize with the arrow keys. Split the active file with Alt+Backslash. Its separator is named "Left and right document panes" on desktop and "Top and bottom document panes" in the stacked phone layout; arrow-key resizing follows that orientation. Each pane has Document controls; Git actions appears once, in the rightmost pane. The first pane alone has Toggle Sidebar. Phone-width panes stack to retain usable controls.
5. Step with Alt+ArrowLeft/Alt+ArrowRight; close the last side file with Alt+W. The split collapses, the primary Review/Changes tab remains, and Git is still present once. Reload and confirm the layout remains usable.
6. Open Git actions. Labels occupy one line, descriptions appear in tooltips, and disabled reasons remain visible. Commit/Push/Pull follows existing Git state; test a disabled menu entry and busy/recovery feedback too.

## Gotchas

- A duplicated Review remains permanent in its pane. Use the tab context menu’s Close pane to collapse a split without closing the primary Review.
- A fresh empty worktree displays Changes without adding a default-document navigation to its address.
- Review/Changes cannot be unpinned or removed by Close others or Close unpinned. Previously saved empty primary panes acquire this tab.
- The existing right panel and sheet behavior is unchanged. Open documents from that sheet closes it and returns focus to the document.
- Desktop uses this same renderer; native bridge proof belongs to desktop verification.
