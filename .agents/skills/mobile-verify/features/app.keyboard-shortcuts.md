---
screen: /keyboard-shortcuts
selectors:
  - 'keyboard-shortcuts'
  - 'Keyboard Shortcuts'
  - 'settings-keyboard-shortcuts'
tests:
  - apps/mobile/src/shared/rules/key-commands.spec.ts
  - apps/mobile/src/shared/rules/list-cursor.spec.ts
  - apps/mobile/src/shared/rules/navigation-exits.spec.ts
  - apps/mobile/src/shared/application/key-registry.spec.ts
api: []
---

# app.keyboard-shortcuts

On iPhone and iPad with a hardware keyboard, Porcelain registers the shortcuts that work on the current screen with the system main menu, so holding Command shows them grouped as Go, Worktree, List and Document, and the iPad menu bar lists the same menus. Go: ⌘[ and Esc go Back when a screen can go back (Esc also closes a sheet or Settings at its first page), ⌘W closes the presented sheet or Settings, ⌘, opens Settings and ⌘/ opens Keyboard Shortcuts. Worktree: ⌘1, ⌘2 and ⌘3 choose Changes, Files and History on a worktree page. List: ↓/J and ↑/K move a visible highlight through the active list (the worktree list or the file tree), Return opens the highlighted row, → and ← open and close a folder in the file tree (← on a file or closed folder moves to its parent folder), ⌘F focuses the active list's search, and Tab moves the keys to the next list on screen (iPad, list beside detail). Document: ⌘⇧T Timeline and ⌘⇧S Show source or Show rendered on an open file. While a text field is being edited only the Command shortcuts stay live, so typing, arrows, Return and Esc belong to the field. Keyboard Shortcuts is a sheet listing every shortcut from the same catalog. Android and the web have no hardware shortcuts and no Keyboard Shortcuts row.

## How to get to it (user POV)

- Hold ⌘ on an iPad or iPhone with a hardware keyboard.
- Settings → Keyboard Shortcuts (iOS only), or ⌘/ anywhere.

## Driving it with agent-device

Preconditions: [surface baseline](README.md) on an iPad simulator in landscape, `--fixture development`.

`agent-device` sends taps and text but has no hardware key chords (`keyboard` only reports or dismisses the software keyboard), so key presses go through the Simulator: enable I/O → Keyboard → Connect Hardware Keyboard and Send Keyboard Shortcuts to Device, focus the Simulator window, and press keys on the Mac or send them with `osascript -e 'tell application "System Events" to keystroke "1" using command down'` (`key code 125` is ↓, `126` ↑, `123` ←, `124` →, `36` Return, `53` Esc, `48` Tab). Confirm each result with `snapshot -i` and a screenshot through agent-device.

1. Worktrees tab root: hold ⌘ for about a second. Expect the system overlay with Go (Settings, Keyboard Shortcuts) and List (Next Row, Previous Row, Search, Next List when the detail shows a list). Screenshot it.
2. Press ↓ three times, then ↑: one worktree row shows the highlight and it moves with each press; Return opens that worktree beside the list. J and K do the same.
3. ⌘2: the worktree page shows Files and the file tree, the newest list, takes the keys. Tab hands them back to the worktree list and Tab again returns them to the tree. ↓ to a closed folder, →: it opens; → again highlights its first child; ←: the highlight returns to the folder; ← again closes it. Return on a file opens it beside the tree on a wide tablet and pushed on a narrow one.
4. On the open file: ⌘⇧T opens Timeline; ⌘[ returns; on a Markdown file ⌘⇧S switches Show source and Show rendered; Esc returns to the worktree page.
5. ⌘1 and ⌘3 choose Changes and History; hold ⌘ to see the Worktree group.
6. ⌘F: the active list's search field takes focus. Type a letter: it appears in the field and does not move the highlight. ⌘F again keeps focus; Esc clears or leaves the search as UIKit does, and the shortcuts return when editing ends.
7. ⌘,: Settings opens. Open General, Esc: back to Settings; Esc again or ⌘W closes Settings.
8. ⌘/: Keyboard Shortcuts (`keyboard-shortcuts`) opens as a sheet with Go, Worktree, List and Document; Back lists ⌘[ and Esc on one row. ⌘W closes it. Settings → Keyboard Shortcuts (`settings-keyboard-shortcuts`) opens the same sheet.
9. Portrait and iPhone: steps 2, 4 and 7 behave the same with the worktree page pushed instead of beside the list.
10. Android tablet: the app starts and behaves as before; Settings has no Keyboard Shortcuts row.

Automated coverage: the named rule tests prove the catalog has one combination per shortcut, a doubled live shortcut is dropped for both owners, presses route to the live handler, Command shortcuts alone stay live while typing, cursor and tree movement, list focus, Back and Close availability, that the sheet lists every shortcut, and that a remount hands its shortcuts over without a conflict. `apps/mobile/spec/native-logic` runs the Swift menu plan tests on macOS; the Swift lives in `modules/porcelain-renderer` beside the renderer.

## Gotchas

- ⌘W on a tab root, where Porcelain has nothing to close, is the system's Close Window and closes the app's window.
- A tool that injects HID keys into the simulator (for example `axe key-combo --modifiers 227 --key 56 --udid <udid>` for ⌘/) presses shortcuts without the Simulator window or the Mac's keyboard focus; it cannot hold ⌘ for the overlay.
- Without Send Keyboard Shortcuts to Device the Simulator keeps ⌘1–⌘3, ⌘, and ⌘W for its own window menu.
- The shortcuts live in the main menu (`UIMainMenuSystem`), so they work whatever holds focus; a doubled shortcut is logged as an error and neither owner fires.
- The history list has no highlight yet; it is the next list to wire through the same `useListCursor`. The worktree list highlights without scrolling the row into view.
- Space does not page code, diffs or Markdown through Porcelain; check whether the native scroll views already page with Space before adding it.
